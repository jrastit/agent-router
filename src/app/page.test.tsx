import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("mid-hackathon demo", () => {
  it("renders interactive routing and verified Hedera evidence", () => {
    const html = renderToStaticMarkup(<Home />);

    expect(html).toContain("Route a summarization task");
    expect(html).toContain("Scaleway Generative APIs");
    expect(html).toContain("Private Compute Provider");
    expect(html).toContain("no new payment is submitted");
    expect(html).toContain("Mirror verified");
    expect(html).toContain("hashscan.io/testnet/transaction");
    expect(html).toContain("Discover");
    expect(html).toContain("Record");
  });
});
