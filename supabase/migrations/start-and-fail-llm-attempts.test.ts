import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260726000900_start_and_fail_llm_attempts.sql",
  "utf8",
);

describe("LLM attempt transition migration", () => {
  it("starts exactly one attempt under a locked reserved job", () => {
    expect(migration).toContain("create function public.start_llm_job_attempt");
    expect(migration).toMatch(/state <> 'reserved'[\s\S]*attempt_number/);
    expect(migration).toContain("set state = 'executing'");
    expect(migration).toContain("attempt.idempotency_key = request_key");
  });

  it("releases only failures known not to require reconciliation", () => {
    expect(migration).toContain("'PROVIDER_AUTHENTICATION'");
    expect(migration).not.toMatch(/failure not in \([\s\S]*'PROVIDER_TIMEOUT'/);
    expect(migration).toContain(
      "available_tinybar + reservation.amount_tinybar",
    );
    expect(migration).toContain("set status = 'released'");
  });
});
