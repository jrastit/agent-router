import { describe, expect, it, vi } from "vitest";

import type { ModelRoute } from "../src/toolkit";
import { DeterministicModelRouter } from "../src/toolkit";
import { runZgAgent } from "./0g-agent";

const routes: ModelRoute[] = ["1", "2"].map((id) => ({
  id,
  providerAddress: `0x${id.padStart(40, "0")}`,
  model: `0g-model-${id}`,
  capability: "chat",
  privacy: "confidential",
  expectedLatencyMs: 100,
  price: {
    currency: "0G",
    inputAmount: id,
    outputAmount: "1",
    unit: "million-tokens",
  },
  provenance: {
    network: "0g-mainnet",
    endpoint: "https://router-api.0g.ai/v1",
    verification: "provider-address",
  },
}));

describe("example 0G agent", () => {
  it("runs the complete path without publishing prompt or output", async () => {
    let stored = "";
    const receiptHash = `0x${"55".repeat(32)}`;
    const result = await runZgAgent(
      {
        catalog: { list: vi.fn().mockResolvedValue(routes) },
        router: new DeterministicModelRouter(),
        compute: {
          execute: vi.fn().mockResolvedValue({
            output: "confidential raw output",
            evidence: {
              providerAddress: routes[0].providerAddress,
              model: routes[0].model,
              network: "0g-mainnet",
              executionId: "safe-id",
              verification: "0g-router-response",
              verified: true,
            },
          }),
        },
        storage: {
          persist: vi.fn().mockImplementation((request) => {
            stored = new TextDecoder().decode(request.content);
            return {
              network: "0g-galileo-testnet",
              rootHash: `0x${"33".repeat(32)}`,
              transactionHash: `0x${"44".repeat(32)}`,
            };
          }),
        },
        provenanceAnchor: {
          anchor: vi.fn().mockImplementation((request) => ({
            transactionHash: receiptHash,
            blockNumber: "42",
            anchored: request.receiptHash,
          })),
        },
        provenanceVerifier: {
          verify: vi.fn().mockResolvedValue({
            verified: true,
            anchoredReceiptHash: receiptHash,
            blockNumber: "42",
          }),
        },
        now: () => "2026-07-25T05:00:00.000Z",
      },
      {
        prompt: "confidential prompt",
        requestHash: `0x${"11".repeat(32)}`,
        policyHash: `0x${"22".repeat(32)}`,
        policy: { requireConfidential: true },
        idempotencyKey: "example-1",
        provenanceNetwork: "0g-galileo-testnet",
      },
    );

    expect(result.decision.candidates).toHaveLength(2);
    expect(result.output).toBe("confidential raw output");
    expect(stored).not.toMatch(/confidential prompt|confidential raw output/);
    expect(JSON.stringify(result.receipt)).not.toMatch(
      /confidential prompt|confidential raw output/,
    );
  });
});
