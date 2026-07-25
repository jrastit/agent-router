import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("mid-hackathon demo", () => {
  it("renders interactive routing and verified Hedera evidence", () => {
    const html = renderToStaticMarkup(<Home />);

    expect(html).toContain("Route a summarization task");
    expect(html).toContain("Scaleway Generative APIs");
    expect(html).toContain("Private Compute Provider");
    expect(html).toContain("LLM instances");
    expect(html).toContain("no new payment is submitted");
    expect(html).toContain("Mirror verified");
    expect(html).toContain("hashscan.io/testnet/transaction");
    expect(html).toContain("Discover");
    expect(html).toContain("Record");
    expect(html).toContain("Restored persisted timeline");
    expect(html).toContain("Delivered result");
    expect(html).toContain("Total spend");
    expect(html).toContain("Remaining budget");
    expect(html).toContain("Open receipt");
    expect(html).toContain("Run timeline");
    expect(html).toContain("Latest Graph activity");
    expect(html).toContain("User deposits and spending");
    expect(html).toContain("Live indexed account activity");
    expect(html).toContain("Add funds");
    expect(html).toContain("You stay in control");
    expect(html).toContain("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID");
    expect(html).toContain("Loading live data");
  });
});
