import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260726000700_reserve_llm_job_credit.sql",
  "utf8",
);

describe("atomic LLM credit reservation migration", () => {
  it("locks the owned job and credit account before reserving", () => {
    expect(migration).toMatch(/from public\.llm_jobs[\s\S]*for update;/);
    expect(migration).toMatch(/from public\.credit_accounts[\s\S]*for update;/);
    expect(migration).toContain("account.available_tinybar < maximum_charge");
  });

  it("revalidates exact pricing and the user spend ceiling", () => {
    expect(migration).toContain("+ 999999");
    expect(migration).toContain("/ 1000000");
    expect(migration).toContain(
      "maximum_charge > target_job.spend_ceiling_tinybar",
    );
    expect(migration).toContain("interval '24 hours'");
  });

  it("updates reservation, ledger balances, journal, and job atomically", () => {
    expect(migration).toContain("insert into public.llm_job_reservations");
    expect(migration).toContain("update public.credit_accounts");
    expect(migration).toContain("insert into public.credit_journal");
    expect(migration).toContain("set state = 'reserved'");
    expect(migration).toContain("reservation.idempotency_key = request_key");
  });
});
