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
