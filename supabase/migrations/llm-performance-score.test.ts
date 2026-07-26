import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260726001100_add_llm_performance_score.sql",
  "utf8",
);

describe("LLM performance score migration", () => {
  it("bounds the estimate and records its versioned basis", () => {
    expect(migration).toContain("performance_score between 0 and 100");
    expect(migration).toContain("catalog-readiness-v1");
    expect(migration).toContain("not a benchmark claim");
  });
});
