import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("health page", () => {
  it("reports system health and the complete commerce loop", () => {
    const html = renderToStaticMarkup(<Home />);

    expect(html).toContain("System healthy");
    expect(html).toContain("Discover");
    expect(html).toContain("Record");
  });
});
