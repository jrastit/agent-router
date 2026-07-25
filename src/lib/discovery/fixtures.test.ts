import { describe, expect, it } from "vitest";

import { FixtureDiscoveryAdapter } from "./fixtures";

const query = {
  jobId: "job_fixture",
  capability: "summarize",
  inputType: "text",
  outputType: "text",
  now: "2026-07-25T12:00:00.000Z",
};

describe("FixtureDiscoveryAdapter", () => {
  it("returns two comparable normalized providers with fixture provenance", async () => {
    const result = await new FixtureDiscoveryAdapter().discover(query);

    expect(result.source).toEqual({
      kind: "fixture",
      label: "deterministic-demo-v1",
    });
    expect(result.providers).toHaveLength(2);
    expect(
      result.providers.every(
        ({ offer, provider, quote }) =>
          offer.providerId === provider.id &&
          quote.offerId === offer.id &&
          quote.price.amountMinor === offer.price.amountMinor,
      ),
    ).toBe(true);
  });

  it("returns an explicit empty fixture result for unsupported workloads", async () => {
    const result = await new FixtureDiscoveryAdapter().discover({
      ...query,
      capability: "translate",
    });

    expect(result.providers).toEqual([]);
    expect(result.source.kind).toBe("fixture");
  });

  it("rejects an invalid query timestamp", async () => {
    await expect(
      new FixtureDiscoveryAdapter().discover({ ...query, now: "invalid" }),
    ).rejects.toThrow("ISO timestamp");
  });
});
