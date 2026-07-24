#!/usr/bin/env bash
set -euo pipefail

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL must be configured}"

if [[ -z "${PSQL_BIN:-}" ]]; then
  PSQL_BIN="$(command -v psql || true)"
fi
if [[ -z "$PSQL_BIN" && -x /opt/homebrew/opt/postgresql@15/bin/psql ]]; then
  PSQL_BIN=/opt/homebrew/opt/postgresql@15/bin/psql
fi
: "${PSQL_BIN:?psql 15 or later must be installed or PSQL_BIN configured}"
export PSQL_BIN

node --env-file=.env -e '
  const { spawnSync } = require("node:child_process");
  const url = new URL(process.env.SUPABASE_DB_URL);
  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
    url.searchParams.set("sslmode", "disable");
  }
  const psql = process.env.PSQL_BIN;
  const args = [
    url.toString(), "-X", "-v", "ON_ERROR_STOP=1", "-c", "begin",
    "-f", "supabase/migrations/20260725000100_create_commerce_domain.sql",
    "-f", "supabase/migrations/20260725000200_add_atomic_workflows.sql",
    "-f", "supabase/tests/phase2.sql", "-c", "rollback",
  ];
  const result = spawnSync(psql, args, { stdio: "inherit" });
  process.exit(result.status ?? 1);
'
