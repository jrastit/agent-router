import { spawnSync } from "node:child_process";

const confirmation = "--confirm-production-migrations";
const apply = process.argv.includes(confirmation);
const rawDatabaseUrl = process.env.SUPABASE_DB_URL;

if (!rawDatabaseUrl) {
  throw new Error("SUPABASE_DB_URL must be configured");
}

const databaseUrl = new URL(rawDatabaseUrl);
const processEnvironment = {
  ...process.env,
  ...(databaseUrl.hostname === "127.0.0.1" ||
  databaseUrl.hostname === "localhost"
    ? { PGSSLMODE: "disable" }
    : {}),
};
const cliArguments = [
  "db",
  "push",
  "--db-url",
  databaseUrl.toString(),
  "--include-all",
  ...(!apply ? ["--dry-run"] : []),
];

const push = spawnSync("./node_modules/.bin/supabase", cliArguments, {
  env: processEnvironment,
  stdio: "inherit",
});
if (push.status !== 0) {
  process.exit(push.status ?? 1);
}
if (!apply) {
  console.log(
    `Dry run complete. Pass ${confirmation} only after reviewing the migration list.`,
  );
  process.exit(0);
}

const psql = process.env.PSQL_BIN ?? "psql";
const probe = spawnSync(
  psql,
  [
    databaseUrl.toString(),
    "-X",
    "-v",
    "ON_ERROR_STOP=1",
    "-At",
    "-c",
    `
      select json_build_object(
        'latestMigration', (
          select max(version)
          from supabase_migrations.schema_migrations
        ),
        'depositTable', to_regclass('public.deposits') is not null,
        'projectionTable',
          to_regclass('public.verified_hedera_projection_events') is not null,
        'creditFunction',
          to_regprocedure(
            'public.credit_verified_deposit(text,text,text,timestamptz,text,text,text)'
          ) is not null,
        'serverCreditFunction',
          to_regprocedure(
            'public.credit_verified_deposit_for_user(uuid,text,text,text,timestamptz,text,text,text)'
          ) is not null
      );
    `,
  ],
  {
    env: processEnvironment,
    stdio: "inherit",
  },
);
process.exit(probe.status ?? 1);
