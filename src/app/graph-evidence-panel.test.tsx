import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import GraphEvidencePanel from "./graph-evidence-panel";

describe("Graph evidence MCP panel", () => {
  it("renders the quick live lookup and authority boundary", () => {
    const html = renderToStaticMarkup(<GraphEvidencePanel />);
    expect(html).toContain("Inspect public agent transactions");
    expect(html).toContain("find_payment");
    expect(html).toContain(
      "0x511f1c5563ef498dcdc857ee09d596a593af48838d3de3cbc2fe11194b6c92b8",
    );
    expect(html).toContain("Hedera Mirror verification");
    expect(html).toContain("No Graph key");
  });
});
