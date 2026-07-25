export type ExactPrice = Readonly<{
  currency: string;
  inputAmount: string;
  outputAmount: string;
  unit: string;
}>;

export type ModelRoute = Readonly<{
  id: string;
  providerAddress: string;
  model: string;
  capability: string;
  privacy: "public" | "confidential";
  expectedLatencyMs: number;
  price: ExactPrice;
  provenance: Readonly<{
    network: string;
    endpoint: string;
    verification: string;
  }>;
}>;

export type ModelCatalogQuery = Readonly<{
  capability: string;
  privacy: "public" | "confidential";
}>;

export interface ModelCatalogAdapter {
  list(query: ModelCatalogQuery): Promise<readonly ModelRoute[]>;
}

export type RoutingPolicy = Readonly<{
  maximumInputAmount?: string;
  maximumOutputAmount?: string;
  maximumLatencyMs?: number;
  requireConfidential?: boolean;
}>;

export type RoutingDecision = Readonly<{
  selected: ModelRoute;
  candidates: readonly ModelRoute[];
  excluded: readonly Readonly<{
    route: ModelRoute;
    reasons: readonly string[];
  }>[];
}>;

export interface ModelRouter {
  select(routes: readonly ModelRoute[], policy: RoutingPolicy): RoutingDecision;
}

export type ComputeExecutionRequest = Readonly<{
  route: ModelRoute;
  prompt: string;
  idempotencyKey: string;
  timeoutMs?: number;
}>;

export type ComputeExecutionEvidence = Readonly<{
  providerAddress: string;
  model: string;
  network: string;
  executionId: string;
  verification: string;
  verified: boolean;
}>;

export type ComputeExecutionResult = Readonly<{
  output: string;
  evidence: ComputeExecutionEvidence;
}>;

export interface ComputeExecutionAdapter {
  execute(request: ComputeExecutionRequest): Promise<ComputeExecutionResult>;
}

export type StorageEvidenceRequest = Readonly<{
  content: Uint8Array;
  mediaType: string;
  idempotencyKey: string;
  classification: "public-non-secret";
}>;

export type StorageEvidenceReference = Readonly<{
  network: string;
  rootHash: string;
  transactionHash?: string;
}>;

export interface StorageEvidenceAdapter {
  persist(request: StorageEvidenceRequest): Promise<StorageEvidenceReference>;
}

export type ProvenanceVerificationRequest = Readonly<{
  receiptHash: string;
  network: string;
  transactionHash: string;
}>;

export type ProvenanceVerificationResult = Readonly<{
  verified: boolean;
  anchoredReceiptHash?: string;
  blockNumber?: string;
}>;

export interface ProvenanceVerifier {
  verify(
    request: ProvenanceVerificationRequest,
  ): Promise<ProvenanceVerificationResult>;
}
