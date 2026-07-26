import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260726000800_settle_llm_job_credit.sql",
  "utf8",
);

describe("atomic LLM credit settlement migration", () => {
  it("recomputes exact usage cost from the reserved snapshot", () => {
    expect(migration).toContain(
      "reservation.price_snapshot ->> 'inputTinybarsPerMillionTokens'",
    );
    expect(migration).toContain(
      "reservation.price_snapshot ->> 'outputTinybarsPerMillionTokens'",
    );
    expect(migration).toContain("actual charge exceeds reservation");
    expect(migration).toContain("unused_credit :=");
  });

  it("persists delivery and accounting records before delivery state", () => {
    const usage = migration.indexOf("insert into public.llm_job_usage");
    const result = migration.indexOf("insert into public.llm_job_results");
    const evidence = migration.indexOf(
      "insert into public.llm_job_provider_evidence",
    );
    const charge = migration.indexOf("insert into public.llm_job_charges");
    const delivered = migration.indexOf("set state = 'delivered'");
    expect(Math.min(usage, result, evidence, charge)).toBeGreaterThan(-1);
    expect(delivered).toBeGreaterThan(
      Math.max(usage, result, evidence, charge),
    );
  });

  it("moves ambiguous reservations to reconciliation exactly once", () => {
    expect(migration).toContain(
      "create function public.reconcile_ambiguous_llm_job",
    );
    expect(migration).toContain(
      "reconciliation_tinybar + reservation.amount_tinybar",
    );
    expect(migration).toContain("target_job.state = 'reconciliation_required'");
    expect(migration).toContain("set state = 'ambiguous'");
  });

  it("requires precise 0G evidence and contains no public prompt projection", () => {
    expect(migration).toContain("%not independently attested%");
    expect(migration).not.toMatch(
      /monitoring_projection_outbox|0g_storage|chain_event|graph_entity/i,
    );
  });
});
