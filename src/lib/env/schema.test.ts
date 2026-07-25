import { describe, expect, it } from "vitest";

import { publicEnvSchema, serverEnvSchema, serverOnlyEnvKeys } from "./schema";

describe("environment contract", () => {
  it("uses safe local defaults", () => {
    expect(publicEnvSchema.parse({})).toEqual({
      NEXT_PUBLIC_APP_NAME: "AgentRouter",
    });
    expect(serverEnvSchema.parse({})).toMatchObject({
      APP_ENV: "development",
      HEDERA_NETWORK: "testnet",
      HEDERA_PROJECTION_PUBLIC_QUERY_URL:
        "https://graph.router.fexhu.com/subgraphs/name/agent-router/hedera-projection",
      DISCOVERY_SOURCE: "fixture",
      GRAPH_MAX_STALENESS_MS: 300_000,
      ZG_ROUTER_BASE_URL: "https://router-api.0g.ai/v1",
      ZG_COMPUTE_MAX_ATTEMPTS: 3,
      ZG_COMPUTE_TIMEOUT_MS: 30_000,
    });
  });

  it("keeps both 0G Router credentials server-only", () => {
    const parsed = serverEnvSchema.parse({
      G_API_KEY_PRIVATE: "sk-inference",
      G_API_KEY_MANAGEMENT: "mk-management",
    });
    expect(parsed).toMatchObject({
      G_API_KEY_PRIVATE: "sk-inference",
      G_API_KEY_MANAGEMENT: "mk-management",
    });
    expect(serverOnlyEnvKeys).toEqual(
      expect.arrayContaining(["G_API_KEY_PRIVATE", "G_API_KEY_MANAGEMENT"]),
    );
  });

  it("parses server-only Graph discovery configuration", () => {
    expect(
      serverEnvSchema.parse({
        DISCOVERY_SOURCE: "the-graph",
        GRAPH_ENDPOINT: "https://gateway.thegraph.com/api/subgraphs/id/example",
        GRAPH_DEPLOYMENT_ID: "QmExample",
        GRAPH_NETWORK: "base-sepolia",
        GRAPH_MAX_STALENESS_MS: "60000",
        GRAPH_ACCESS_TOKEN: "secret",
      }),
    ).toMatchObject({
      DISCOVERY_SOURCE: "the-graph",
      GRAPH_MAX_STALENESS_MS: 60_000,
    });
  });

  it("keeps the projection query endpoint server-side", () => {
    const url =
      "https://graph.router.fexhu.com/subgraphs/name/agent-router/hedera-projection";
    expect(
      serverEnvSchema.parse({
        HEDERA_PROJECTION_PUBLIC_QUERY_URL: url,
      }).HEDERA_PROJECTION_PUBLIC_QUERY_URL,
    ).toBe(url);
    expect(serverOnlyEnvKeys).toContain("HEDERA_PROJECTION_PUBLIC_QUERY_URL");
  });

  it("rejects malformed server configuration", () => {
    expect(() => serverEnvSchema.parse({ APP_ENV: "staging" })).toThrow();
    expect(() =>
      serverEnvSchema.parse({ HEDERA_NETWORK: "mainnet" }),
    ).toThrow();
  });

  it("does not allow server-only keys in the public contract", () => {
    for (const key of serverOnlyEnvKeys) {
      expect(key).not.toMatch(/^NEXT_PUBLIC_/);
    }

    expect(() =>
      publicEnvSchema.parse({
        NEXT_PUBLIC_APP_NAME: "AgentRouter",
        OPENAI_API_KEY: "must-not-reach-the-browser",
      }),
    ).toThrow();
  });
});
