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
    expect(html).toContain("Restored persisted timeline");
    expect(html).toContain("Delivered result");
    expect(html).toContain("Total spend");
    expect(html).toContain("Remaining budget");
    expect(html).toContain("Open receipt");
    expect(html).toContain("Prepaid application credit");
    expect(html).toContain("Credited");
    expect(html).toContain("Reserved");
    expect(html).toContain("Spent");
    expect(html).toContain("Refunded");
    expect(html).toContain("Reconciliation");
    expect(html).toContain("Projection · pending independently");
    expect(html).toContain(
      "No direct or automatic HBAR-to-0G conversion is claimed",
    );
  });
});
