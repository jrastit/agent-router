import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync("scripts/deploy-supabase-migrations.mjs", "utf8");

describe("production Supabase migration deployment", () => {
  it("defaults to a dry run and requires an explicit apply confirmation", () => {
    expect(source).toContain("--confirm-production-migrations");
    expect(source).toContain('...(!apply ? ["--dry-run"] : [])');
    expect(source).toContain('"--include-all"');
  });

  it("does not print the database URL and probes the deployed contracts", () => {
    expect(source).not.toContain("console.log(databaseUrl");
    expect(source).toContain("supabase_migrations.schema_migrations");
    expect(source).toContain("public.deposits");
    expect(source).toContain("public.verified_hedera_projection_events");
    expect(source).toContain("public.credit_verified_deposit");
  });

  it("disables TLS only for a loopback self-hosted database", () => {
    expect(source).toContain('databaseUrl.hostname === "127.0.0.1"');
    expect(source).toContain('databaseUrl.hostname === "localhost"');
    expect(source).toContain('PGSSLMODE: "disable"');
  });
});
