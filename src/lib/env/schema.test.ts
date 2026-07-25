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
      DISCOVERY_SOURCE: "fixture",
      GRAPH_MAX_STALENESS_MS: 300_000,
    });
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
