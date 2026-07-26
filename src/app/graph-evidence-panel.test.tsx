import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import GraphEvidencePanel from "./graph-evidence-panel";

describe("Graph evidence MCP panel", () => {
  it("renders the quick live lookup and authority boundary", () => {
    const html = renderToStaticMarkup(<GraphEvidencePanel />);
    expect(html).toContain("Inspect public agent transactions");
    expect(html).toContain("find_payment");
    expect(html).toContain(
      "0xdb3a831451eedd88f68ff90d2d2a6343283b6164282cd600540babb673183a65",
    );
    expect(html).toContain("Hedera Mirror verification");
    expect(html).toContain("No Graph key");
    expect(html).toContain("MCP instance selection");
    expect(html).toContain("list_llm_instances");
    expect(html).toContain("Create job with MCP");
  });
});
