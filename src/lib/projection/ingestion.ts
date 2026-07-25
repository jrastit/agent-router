export type ProjectionCorrelation = {
  sourceEventId: `0x${string}`;
  depositState: "credited";
  projectionState: "confirmed";
  destinationTransactionHash: `0x${string}`;
  destinationBlockNumber: string;
  graphState: "pending" | "indexed" | "mismatch";
};

export type ProjectionGraphEntity = {
  id: `0x${string}`;
  hederaTransactionHash: `0x${string}`;
  consensusTimestamp: string;
  destinationTransactionHash: `0x${string}`;
  destinationBlockNumber: string;
};

export type ProjectionIngestionStore = {
  loadCorrelation(sourceEventId: string): Promise<ProjectionCorrelation | null>;
  recordGraphPending(input: {
    sourceEventId: string;
    reason: "ENTITY_NOT_INDEXED";
  }): Promise<ProjectionCorrelation>;
  recordGraphIndexed(input: {
    sourceEventId: string;
    entity: ProjectionGraphEntity;
  }): Promise<ProjectionCorrelation>;
  recordGraphMismatch(input: {
    sourceEventId: string;
    reason: string;
  }): Promise<ProjectionCorrelation>;
};

export type ProjectionGraph = {
  loadAnchor(sourceEventId: string): Promise<ProjectionGraphEntity | null>;
};

export async function ingestProjectedHederaEvent(input: {
  sourceEventId: `0x${string}`;
  expectedHederaTransactionHash: `0x${string}`;
  expectedConsensusTimestamp: string;
  store: ProjectionIngestionStore;
  graph: ProjectionGraph;
}): Promise<ProjectionCorrelation> {
  const correlation = await input.store.loadCorrelation(input.sourceEventId);
  if (!correlation) {
    throw new Error("durable projection correlation not found");
  }
  if (correlation.graphState === "indexed") {
    return correlation;
  }

  const entity = await input.graph.loadAnchor(input.sourceEventId);
  if (!entity) {
    return input.store.recordGraphPending({
      sourceEventId: input.sourceEventId,
      reason: "ENTITY_NOT_INDEXED",
    });
  }

  const mismatch = [
    entity.id !== input.sourceEventId && "source event ID",
    entity.hederaTransactionHash !== input.expectedHederaTransactionHash &&
      "Hedera transaction hash",
    entity.consensusTimestamp !== input.expectedConsensusTimestamp &&
      "consensus timestamp",
    entity.destinationTransactionHash !==
      correlation.destinationTransactionHash && "destination transaction hash",
    entity.destinationBlockNumber !== correlation.destinationBlockNumber &&
      "destination block number",
  ].find(Boolean);
  if (mismatch) {
    return input.store.recordGraphMismatch({
      sourceEventId: input.sourceEventId,
      reason: `indexed ${mismatch} mismatch`,
    });
  }

  return input.store.recordGraphIndexed({
    sourceEventId: input.sourceEventId,
    entity,
  });
}
