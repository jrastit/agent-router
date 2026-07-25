export type ProjectionReconciliationSnapshot = {
  sourceEventId: `0x${string}`;
  credited: boolean;
  durableRelayRecord: boolean;
  destinationAnchored: boolean;
  destinationFinalized: boolean;
  graphEntity: "indexed" | "missing" | "mismatch";
};

export type ProjectionReconciliationFinding = {
  sourceEventId: `0x${string}`;
  code:
    | "CREDITED_EVENT_MISSING_ANCHOR"
    | "ANCHOR_MISSING_DURABLE_RECORD"
    | "GRAPH_ENTITY_LAGGING"
    | "GRAPH_ENTITY_MISMATCH";
  action:
    | "RETRY_EXISTING_PROJECTION"
    | "IMPORT_DESTINATION_EVIDENCE"
    | "RETRY_GRAPH_INGESTION"
    | "REVIEW_PROVENANCE";
  affectsAuthoritativeCredit: false;
};

export function reconcileProjection(
  snapshot: ProjectionReconciliationSnapshot,
): ProjectionReconciliationFinding[] {
  const findings: ProjectionReconciliationFinding[] = [];
  const add = (
    code: ProjectionReconciliationFinding["code"],
    action: ProjectionReconciliationFinding["action"],
  ) =>
    findings.push({
      sourceEventId: snapshot.sourceEventId,
      code,
      action,
      affectsAuthoritativeCredit: false,
    });

  if (
    snapshot.credited &&
    snapshot.durableRelayRecord &&
    !snapshot.destinationAnchored
  ) {
    add("CREDITED_EVENT_MISSING_ANCHOR", "RETRY_EXISTING_PROJECTION");
  }
  if (snapshot.destinationAnchored && !snapshot.durableRelayRecord) {
    add("ANCHOR_MISSING_DURABLE_RECORD", "IMPORT_DESTINATION_EVIDENCE");
  }
  if (snapshot.destinationFinalized && snapshot.graphEntity === "missing") {
    add("GRAPH_ENTITY_LAGGING", "RETRY_GRAPH_INGESTION");
  }
  if (snapshot.graphEntity === "mismatch") {
    add("GRAPH_ENTITY_MISMATCH", "REVIEW_PROVENANCE");
  }

  return findings;
}
