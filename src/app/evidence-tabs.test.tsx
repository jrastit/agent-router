import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CopyReference } from "./evidence-tabs";

describe("Graph event reference", () => {
  it("renders the full reference in an accessible MCP copy action", () => {
    const reference = `0x${"12".repeat(32)}`;
    const html = renderToStaticMarkup(<CopyReference reference={reference} />);

    expect(html).toContain("Record reference");
    expect(html).toContain("Copy for MCP");
    expect(html).toContain(reference);
    expect(html).toContain(`Copy Graph record reference ${reference}`);
  });
});
