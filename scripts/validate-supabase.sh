#!/usr/bin/env bash
set -euo pipefail

if [[ -f .env && -z "${SUPABASE_DB_URL:-}" ]]; then
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
    "-f", "supabase/migrations/20260725000400_persist_planner_decision.sql",
    "-f", "supabase/migrations/20260725000600_verify_hedera_payments.sql",
    "-f", "supabase/migrations/20260725000700_store_hedera_audit_evidence.sql",
    "-f", "supabase/migrations/20260725000800_add_prepaid_hbar_credit.sql",
    "-f", "supabase/migrations/20260725000900_persist_hedera_projection.sql",
    "-f", "supabase/migrations/20260725001000_harden_hedera_projection_recovery.sql",
    "-f", "supabase/migrations/20260725001100_add_server_deposit_credit.sql",
    "-f", "supabase/migrations/20260726000100_add_realtime_fund_activity.sql",
    "-f", "supabase/migrations/20260726000200_expose_deposit_verification_planes.sql",
    "-f", "supabase/tests/phase2.sql",
    "-f", "supabase/tests/phase4.sql",
    "-f", "supabase/tests/phase6.sql",
    "-f", "supabase/tests/phase6a.sql",
    "-f", "supabase/tests/phase6b.sql",
    "-f", "supabase/tests/realtime_fund_activity.sql",
    "-f", "supabase/tests/phase8.sql", "-c", "rollback",
  ];
  const result = spawnSync(psql, args, { stdio: "inherit" });
  process.exit(result.status ?? 1);
'
