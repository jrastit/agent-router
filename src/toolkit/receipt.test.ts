import { describe, expect, it } from "vitest";

import type { ModelRoute } from "./contracts";
import {
  canonicalizeRoutingReceipt,
  createRoutingReceipt,
  hashRoutingReceipt,
} from "./receipt";

const route = (id: string, inputAmount: string): ModelRoute => ({
  id,
  providerAddress: `0x${id.padStart(40, "0")}`,
  model: `model-${id}`,
  capability: "chat",
  privacy: "confidential",
  expectedLatencyMs: 500,
  price: {
    currency: "0G",
    inputAmount,
    outputAmount: "2",
    unit: "million-tokens",
  },
  provenance: {
    network: "0g-mainnet",
    endpoint: "https://router-api.0g.ai/v1",
    verification: "provider-address",
  },
});

function receipt() {
  const candidates = [route("1", "1"), route("2", "2")];
  return createRoutingReceipt({
    requestHash: `0x${"11".repeat(32)}`,
    policyHash: `0x${"22".repeat(32)}`,
    candidates,
    selected: candidates[0],
    execution: {
      providerAddress: candidates[0].providerAddress,
      model: candidates[0].model,
      network: "0g-mainnet",
      executionId: "safe-execution-id",
      verification: "0g-router-response",
      verified: true,
    },
    storage: {
      network: "0g-galileo-testnet",
      rootHash: `0x${"33".repeat(32)}`,
      transactionHash: `0x${"44".repeat(32)}`,
    },
    network: "0g-galileo-testnet",
    timestamp: "2026-07-25T06:00:00+01:00",
  });
}

describe("routing receipt", () => {
  it("is deterministic and normalizes hashes and timestamps", () => {
    const first = receipt();
    const second = { ...first };

    expect(first.timestamp).toBe("2026-07-25T05:00:00.000Z");
    expect(hashRoutingReceipt(first)).toBe(hashRoutingReceipt(second));
    expect(canonicalizeRoutingReceipt(first)).toMatchInlineSnapshot(
      `"{"acceptedQuote":{"currency":"0G","inputAmount":"1","outputAmount":"2","unit":"million-tokens"},"candidates":[{"capability":"chat","expectedLatencyMs":500,"model":"model-1","network":"0g-mainnet","price":{"currency":"0G","inputAmount":"1","outputAmount":"2","unit":"million-tokens"},"privacy":"confidential","providerAddress":"0x0000000000000000000000000000000000000001","routeId":"1","verification":"provider-address"},{"capability":"chat","expectedLatencyMs":500,"model":"model-2","network":"0g-mainnet","price":{"currency":"0G","inputAmount":"2","outputAmount":"2","unit":"million-tokens"},"privacy":"confidential","providerAddress":"0x0000000000000000000000000000000000000002","routeId":"2","verification":"provider-address"}],"execution":{"executionId":"safe-execution-id","model":"model-1","network":"0g-mainnet","providerAddress":"0x0000000000000000000000000000000000000001","verification":"0g-router-response","verified":true},"network":"0g-galileo-testnet","policyHash":"0x2222222222222222222222222222222222222222222222222222222222222222","requestHash":"0x1111111111111111111111111111111111111111111111111111111111111111","selectedModel":"model-1","selectedRouteId":"1","storage":{"network":"0g-galileo-testnet","rootHash":"0x3333333333333333333333333333333333333333333333333333333333333333","transactionHash":"0x4444444444444444444444444444444444444444444444444444444444444444"},"timestamp":"2026-07-25T05:00:00.000Z","version":"agent-router-routing-receipt/v1"}"`,
    );
  });

  it("detects any mutation to bound evidence", () => {
    const original = receipt();
    const tampered = {
      ...original,
      execution: { ...original.execution, model: "different-model" },
    };

    expect(hashRoutingReceipt(tampered)).not.toBe(hashRoutingReceipt(original));
  });

  it("has no prompt, raw output, secret, or artifact fields", () => {
    const serialized = canonicalizeRoutingReceipt(receipt());

    expect(serialized).not.toMatch(/prompt|rawOutput|secret|artifact/i);
  });
});
