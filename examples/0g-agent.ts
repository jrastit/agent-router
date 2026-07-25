import {
  createRoutingReceipt,
  hashRoutingReceipt,
  type ComputeExecutionAdapter,
  type ModelCatalogAdapter,
  type ModelRouter,
  type ProvenanceAnchor,
  type ProvenanceVerifier,
  type RoutingPolicy,
  type StorageEvidenceAdapter,
} from "agent-router/toolkit";

export type ZgAgentDependencies = Readonly<{
  catalog: ModelCatalogAdapter;
  router: ModelRouter;
  compute: ComputeExecutionAdapter;
  storage: StorageEvidenceAdapter;
  provenanceAnchor: ProvenanceAnchor;
  provenanceVerifier: ProvenanceVerifier;
  now?: () => string;
}>;

export type ZgAgentRequest = Readonly<{
  prompt: string;
  requestHash: string;
  policyHash: string;
  policy: RoutingPolicy;
  idempotencyKey: string;
}>;

export async function runZgAgent(
  dependencies: ZgAgentDependencies,
  request: ZgAgentRequest,
) {
  const routes = await dependencies.catalog.list({
    capability: "chat",
    privacy: request.policy.requireConfidential ? "confidential" : "public",
  });
  const decision = dependencies.router.select(routes, request.policy);
  const execution = await dependencies.compute.execute({
    route: decision.selected,
    prompt: request.prompt,
    idempotencyKey: `${request.idempotencyKey}:compute`,
  });

  // This allowlisted document intentionally excludes the prompt and output.
  const publicEvidence = new TextEncoder().encode(
    JSON.stringify({
      version: "agent-router-execution-evidence/v1",
      execution: execution.evidence,
    }),
  );
  const storage = await dependencies.storage.persist({
    content: publicEvidence,
    mediaType: "application/json",
    idempotencyKey: `${request.idempotencyKey}:storage`,
    classification: "public-non-secret",
  });
  const receipt = createRoutingReceipt({
    requestHash: request.requestHash,
    policyHash: request.policyHash,
    candidates: decision.candidates,
    selected: decision.selected,
    execution: execution.evidence,
    storage,
    network: "0g-galileo-testnet",
    timestamp: dependencies.now?.() ?? new Date().toISOString(),
  });
  const receiptHash = hashRoutingReceipt(receipt);
  const anchor = await dependencies.provenanceAnchor.anchor({
    receiptHash,
    network: receipt.network,
    idempotencyKey: `${request.idempotencyKey}:anchor`,
  });
  const verification = await dependencies.provenanceVerifier.verify({
    receiptHash,
    network: receipt.network,
    transactionHash: anchor.transactionHash,
  });
  if (!verification.verified) {
    throw new Error("0G routing receipt provenance verification failed");
  }

  return {
    output: execution.output,
    decision,
    receipt,
    receiptHash,
    anchor,
    verification,
  };
}
