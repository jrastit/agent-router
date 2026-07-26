import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260726000550_add_llm_job_records.sql",
  "utf8",
);

describe("LLM job record migration", () => {
  it("defines every durable accounting and execution record", () => {
    for (const table of [
      "llm_jobs",
      "llm_job_attempts",
      "llm_job_usage",
      "llm_job_reservations",
      "llm_job_charges",
      "llm_job_refunds",
      "llm_job_results",
      "llm_job_provider_evidence",
    ]) {
      expect(migration).toContain(`create table public.${table}`);
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
    }
  });

  it("enforces exact usage, idempotency, ownership, and redaction", () => {
    expect(migration).toContain(
      "total_tokens = prompt_tokens + completion_tokens",
    );
    expect(
      migration.match(/idempotency_key text not null unique/g),
    ).toHaveLength(5);
    expect(migration).toContain("user_id = auth.uid()");
    expect(migration).toContain("'prompt', 'output', 'apiKey'");
    expect(migration).not.toMatch(/api_key\s+text|credential\s+text/i);
  });

  it("retains ambiguous execution and settlement as explicit states", () => {
    expect(migration).toContain("'provider_accepted'");
    expect(migration).toContain("'ambiguous'");
    expect(migration).toContain("'COMPLETION_AMBIGUOUS'");
    expect(migration).toContain("'SETTLEMENT_AMBIGUOUS'");
    expect(migration).toContain("'reconciliation_required'");
  });
});
