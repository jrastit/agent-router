import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260726000600_add_llm_job_inputs_and_pricing.sql",
  "utf8",
);

describe("private LLM inputs and catalog pricing migration", () => {
  it("adds exact catalog prices with an authoritative timestamp", () => {
    expect(migration).toContain("input_price_tinybar_per_million bigint");
    expect(migration).toContain("output_price_tinybar_per_million bigint");
    expect(migration).toContain("price_synced_at timestamptz");
  });

  it("keeps prompts owner-scoped and unavailable to anonymous clients", () => {
    expect(migration).toContain("create table public.llm_job_inputs");
    expect(migration).toContain("foreign key (job_id, user_id)");
    expect(migration).toContain("user_id = auth.uid()");
    expect(migration).toContain(
      "revoke all on public.llm_job_inputs from public, anon",
    );
  });
});
