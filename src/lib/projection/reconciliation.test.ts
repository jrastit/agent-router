import { describe, expect, it } from "vitest";

import { reconcileProjection } from "./reconciliation";

const sourceEventId = `0x${"ab".repeat(32)}` as const;
const complete = {
  sourceEventId,
  credited: true,
  durableRelayRecord: true,
  destinationAnchored: true,
  destinationFinalized: true,
  graphEntity: "indexed" as const,
};

describe("reconcileProjection", () => {
  it("retries a credited event that is missing its destination anchor", () => {
    expect(
      reconcileProjection({
        ...complete,
        destinationAnchored: false,
        destinationFinalized: false,
        graphEntity: "missing",
      }),
    ).toEqual([
      {
        sourceEventId,
        code: "CREDITED_EVENT_MISSING_ANCHOR",
        action: "RETRY_EXISTING_PROJECTION",
        affectsAuthoritativeCredit: false,
      },
    ]);
  });

  it("imports an anchor that has no durable relay record", () => {
    expect(
      reconcileProjection({ ...complete, durableRelayRecord: false }),
    ).toEqual([
      expect.objectContaining({
        code: "ANCHOR_MISSING_DURABLE_RECORD",
        action: "IMPORT_DESTINATION_EVIDENCE",
        affectsAuthoritativeCredit: false,
      }),
    ]);
  });

  it("separates Graph lag from mismatched indexed provenance", () => {
    expect(
      reconcileProjection({ ...complete, graphEntity: "missing" }),
    ).toEqual([
      expect.objectContaining({
        code: "GRAPH_ENTITY_LAGGING",
        action: "RETRY_GRAPH_INGESTION",
      }),
    ]);
    expect(
      reconcileProjection({ ...complete, graphEntity: "mismatch" }),
    ).toEqual([
      expect.objectContaining({
        code: "GRAPH_ENTITY_MISMATCH",
        action: "REVIEW_PROVENANCE",
      }),
    ]);
  });

  it("returns no work for a fully correlated projection", () => {
    expect(reconcileProjection(complete)).toEqual([]);
  });
});
