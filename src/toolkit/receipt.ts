import { keccak256, toUtf8Bytes } from "ethers";

import type {
  ComputeExecutionEvidence,
  ExactPrice,
  ModelRoute,
  StorageEvidenceReference,
} from "./contracts";

type ReceiptCandidate = Readonly<{
  routeId: string;
  providerAddress: string;
  model: string;
  capability: string;
  privacy: "public" | "confidential";
  expectedLatencyMs: number;
  price: ExactPrice;
  network: string;
  verification: string;
}>;

export type RoutingReceipt = Readonly<{
  version: "agent-router-routing-receipt/v1";
  requestHash: string;
  policyHash: string;
  candidates: readonly ReceiptCandidate[];
  selectedRouteId: string;
  selectedModel: string;
  acceptedQuote: ExactPrice;
  execution: ComputeExecutionEvidence;
  storage: StorageEvidenceReference;
  callerId?: string;
  agenticId?: string;
  network: string;
  timestamp: string;
}>;

export type RoutingReceiptInput = Readonly<{
  requestHash: string;
  policyHash: string;
  candidates: readonly ModelRoute[];
  selected: ModelRoute;
  execution: ComputeExecutionEvidence;
  storage: StorageEvidenceReference;
  callerId?: string;
  agenticId?: string;
  network: string;
  timestamp: string;
}>;

const hex32 = /^0x[0-9a-fA-F]{64}$/;

export function createRoutingReceipt(
  input: RoutingReceiptInput,
): RoutingReceipt {
  if (
    !hex32.test(input.requestHash) ||
    !hex32.test(input.policyHash) ||
    input.candidates.length < 2 ||
    !input.candidates.some((route) => route.id === input.selected.id) ||
    input.network.trim() === "" ||
    !Number.isFinite(Date.parse(input.timestamp))
  ) {
    throw new Error("Invalid routing receipt input");
  }

  return {
    version: "agent-router-routing-receipt/v1",
    requestHash: input.requestHash.toLowerCase(),
    policyHash: input.policyHash.toLowerCase(),
    candidates: input.candidates.map(toReceiptCandidate),
    selectedRouteId: input.selected.id,
    selectedModel: input.selected.model,
    acceptedQuote: { ...input.selected.price },
    execution: { ...input.execution },
    storage: { ...input.storage },
    ...(input.callerId ? { callerId: input.callerId } : {}),
    ...(input.agenticId ? { agenticId: input.agenticId } : {}),
    network: input.network,
    timestamp: new Date(input.timestamp).toISOString(),
  };
}

function toReceiptCandidate(route: ModelRoute): ReceiptCandidate {
  return {
    routeId: route.id,
    providerAddress: route.providerAddress,
    model: route.model,
    capability: route.capability,
    privacy: route.privacy,
    expectedLatencyMs: route.expectedLatencyMs,
    price: { ...route.price },
    network: route.provenance.network,
    verification: route.provenance.verification,
  };
}

export function canonicalizeRoutingReceipt(receipt: RoutingReceipt): string {
  return canonicalJson(receipt);
}

export function hashRoutingReceipt(receipt: RoutingReceipt): string {
  return keccak256(toUtf8Bytes(canonicalizeRoutingReceipt(receipt)));
}

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite receipt number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new Error("Unsupported receipt value");
}
