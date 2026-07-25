import { describe, expect, it, vi } from "vitest";

import {
  ingestProjectedHederaEvent,
  type ProjectionCorrelation,
  type ProjectionGraphEntity,
  type ProjectionIngestionStore,
} from "./ingestion";

const sourceEventId = `0x${"aa".repeat(32)}` as const;
const hederaTransactionHash = `0x${"bb".repeat(32)}` as const;
const destinationTransactionHash = `0x${"cc".repeat(32)}` as const;
const correlation: ProjectionCorrelation = {
  sourceEventId,
  depositState: "credited",
  projectionState: "confirmed",
  destinationTransactionHash,
  destinationBlockNumber: "7",
  graphState: "pending",
};
const entity: ProjectionGraphEntity = {
  id: sourceEventId,
  hederaTransactionHash,
  consensusTimestamp: "1721234567.123456789",
  destinationTransactionHash,
  destinationBlockNumber: "7",
};

function store(
  initial: ProjectionCorrelation | null = correlation,
): ProjectionIngestionStore {
  return {
    loadCorrelation: vi.fn().mockResolvedValue(initial),
    recordGraphPending: vi
      .fn()
      .mockResolvedValue({ ...correlation, graphState: "pending" }),
    recordGraphIndexed: vi
      .fn()
      .mockResolvedValue({ ...correlation, graphState: "indexed" }),
    recordGraphMismatch: vi
      .fn()
      .mockResolvedValue({ ...correlation, graphState: "mismatch" }),
  };
}

const request = {
  sourceEventId,
  expectedHederaTransactionHash: hederaTransactionHash,
  expectedConsensusTimestamp: "1721234567.123456789",
};

describe("ingestProjectedHederaEvent", () => {
  it("correlates a credited deposit, destination receipt, and Graph entity", async () => {
    const persistence = store();
    const result = await ingestProjectedHederaEvent({
      ...request,
      store: persistence,
      graph: { loadAnchor: vi.fn().mockResolvedValue(entity) },
    });

    expect(result.graphState).toBe("indexed");
    expect(persistence.recordGraphIndexed).toHaveBeenCalledWith({
      sourceEventId,
      entity,
    });
  });

  it("treats Graph lag as pending monitoring without changing credit", async () => {
    const persistence = store();
    const result = await ingestProjectedHederaEvent({
      ...request,
      store: persistence,
      graph: { loadAnchor: vi.fn().mockResolvedValue(null) },
    });

    expect(result).toMatchObject({
      depositState: "credited",
      graphState: "pending",
    });
    expect(persistence.recordGraphPending).toHaveBeenCalledWith({
      sourceEventId,
      reason: "ENTITY_NOT_INDEXED",
    });
  });

  it("fails closed on mismatched destination provenance", async () => {
    const persistence = store();
    const result = await ingestProjectedHederaEvent({
      ...request,
      store: persistence,
      graph: {
        loadAnchor: vi.fn().mockResolvedValue({
          ...entity,
          destinationTransactionHash: `0x${"dd".repeat(32)}`,
        }),
      },
    });

    expect(result.graphState).toBe("mismatch");
    expect(persistence.recordGraphMismatch).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "indexed destination transaction hash mismatch",
      }),
    );
  });

  it("is idempotent after the correlation is indexed", async () => {
    const persistence = store({ ...correlation, graphState: "indexed" });
    const loadAnchor = vi.fn();
    const result = await ingestProjectedHederaEvent({
      ...request,
      store: persistence,
      graph: { loadAnchor },
    });

    expect(result.graphState).toBe("indexed");
    expect(loadAnchor).not.toHaveBeenCalled();
    expect(persistence.recordGraphIndexed).not.toHaveBeenCalled();
  });
});
