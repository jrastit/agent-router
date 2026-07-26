import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260726001000_read_and_stream_llm_jobs.sql",
  "utf8",
);

describe("LLM job authoritative read model", () => {
  it("returns private owner-scoped delivery and exact accounting", () => {
    expect(migration).toContain("job.user_id = auth.uid()");
    expect(migration).toContain("'reservedTinybars'");
    expect(migration).toContain("'chargedTinybars'");
    expect(migration).toContain("'refundedTinybars'");
    expect(migration).toContain("'remainingBalanceTinybars'");
    expect(migration).toContain("'output', result.output");
  });

  it("exposes redacted evidence without prompts or credentials", () => {
    expect(migration).toContain("'verificationLabel'");
    expect(migration).toContain("'executionId'");
    expect(migration).not.toMatch(/llm_job_inputs|api_key|authorization/i);
  });

  it("publishes persisted job state for recovery notifications", () => {
    expect(migration).toContain(
      "alter publication supabase_realtime add table public.llm_jobs",
    );
  });
});
