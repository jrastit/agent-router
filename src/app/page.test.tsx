import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Home, { evaluateCatalogInstances } from "./page";

describe("mid-hackathon demo", () => {
  it("renders interactive routing and verified Hedera evidence", () => {
    const html = renderToStaticMarkup(<Home />);

    expect(html).toContain("Route a summarization task");
    expect(html).toContain("Live Supabase catalog");
    expect(html).toContain("Loading live instances");
    expect(html).toContain('max="2000"');
    expect(html).toContain("€0.01–€20.00 estimated job-cost ceiling");
    expect(html).toContain("Estimated input tokens");
    expect(html).toContain("1,000,000");
    expect(html).toContain("Estimated output tokens");
    expect(html).toContain("10,000");
    expect(html.match(/max="1000000"/g)).toHaveLength(2);
    expect(html).toContain("Minimum performance score");
    expect(html).toContain("Estimated catalog readiness, not a benchmark");
    expect(html).toContain("LLM instances");
    expect(html).toContain("no new payment is submitted");
    expect(html).toContain("hashscan.io/testnet/transaction");
    expect(html).not.toContain("Run timeline");
    expect(html).toContain("Latest Graph activity");
    expect(html).toContain('href="/presentation"');
    expect(html).toContain("Open presentation");
    expect(html).toContain("User deposits and spending");
    expect(html).toContain("Authoritative application ledger");
    expect(html).toContain("Live Graph audit projection");
    expect(html).toContain("Ganache chain");
    expect(html).toContain("Add funds");
    expect(html).toContain("You stay in control");
    expect(html).toContain("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID");
    expect(html).toContain("Connect your AgentRouter account");
  });

  it("evaluates every Supabase instance and fails closed", () => {
    const base = {
      baseUrl: "https://api.example.com/v1",
      capabilities: ["chat"],
      expectedLatencyMs: 1000,
      inputPriceEurPerMillionTokens: "0.01",
      outputPriceEurPerMillionTokens: "0.02",
    };
    const evaluated = evaluateCatalogInstances(
      {
        version: 1,
        instances: [
          {
            ...base,
            id: "model-a",
            name: "Model A",
            provider: "provider-a",
            model: "model-a",
            privacy: "public",
            enabled: true,
          },
          {
            ...base,
            id: "model-b",
            name: "Model B",
            provider: "provider-b",
            model: "model-b",
            privacy: "confidential",
            enabled: false,
          },
          {
            ...base,
            id: "model-c",
            name: "Model C",
            provider: "provider-c",
            model: "model-c",
            privacy: "confidential",
            enabled: true,
            outputPriceEurPerMillionTokens: undefined,
          },
        ],
      },
      10,
      "public",
      1_000_000,
      10_000,
    );

    expect(evaluated).toHaveLength(3);
    expect(
      evaluated.find((instance) => instance.id === "model-a")?.eligible,
    ).toBe(true);
    expect(
      evaluated.find((instance) => instance.id === "model-b")?.reasons,
    ).toContain("Instance disabled");
    expect(
      evaluated.find((instance) => instance.id === "model-c")?.reasons,
    ).toContain("Exact EUR price unavailable");
    expect(
      evaluated.find((instance) => instance.id === "model-a")
        ?.estimatedCostMicroEur,
    ).toBe(BigInt("10200"));
  });
});
