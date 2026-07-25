import { describe, expect, it, vi } from "vitest";

import { ZgRouterCatalogAdapter } from "./0g-router";

const address = (suffix: string) => `0x${suffix.padStart(40, "0")}`;

describe("ZgRouterCatalogAdapter", () => {
  it("normalizes exact pricing and retains only TeeML routes for privacy", async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/models")) {
        return Response.json({
          data: [
            {
              id: "private-a",
              pricing: { prompt: "463", completion: "2780" },
            },
            {
              id: "verified-b",
              pricing: { prompt: "704", completion: "1400" },
            },
          ],
        });
      }
      return Response.json({
        data: url.includes("private-a")
          ? [
              {
                address: address("1"),
                latency: 1200,
                verifiability: "TeeML",
              },
            ]
          : [
              {
                address: address("2"),
                latency: 800,
                verifiability: "TeeTLS",
              },
            ],
      });
    });
    const adapter = new ZgRouterCatalogAdapter({
      baseUrl: "https://router.example/v1",
      fetch,
    });

    await expect(
      adapter.list({ capability: "chat", privacy: "confidential" }),
    ).resolves.toEqual([
      expect.objectContaining({
        model: "private-a",
        privacy: "confidential",
        expectedLatencyMs: 1200,
        price: {
          currency: "0G",
          inputAmount: "463",
          outputAmount: "2780",
          unit: "neuron-per-token",
        },
        provenance: expect.objectContaining({ verification: "TeeML" }),
      }),
    ]);
  });

  it("returns no routes for unsupported capabilities", async () => {
    const fetch = vi.fn();
    const adapter = new ZgRouterCatalogAdapter({ fetch });

    await expect(
      adapter.list({ capability: "image", privacy: "public" }),
    ).resolves.toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
});
