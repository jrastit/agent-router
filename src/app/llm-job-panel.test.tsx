import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  answerPreview,
  InstanceAnswer,
  runnableCatalogMessage,
} from "./llm-job-panel";

describe("runnable LLM catalog diagnostics", () => {
  it.each([
    [
      "configuration_error",
      "Runnable LLM catalog is not configured on the server.",
    ],
    ["catalog_unauthorized", "Runnable LLM catalog authentication failed."],
    [
      "catalog_query_failed",
      "Runnable LLM catalog schema or query is unavailable.",
    ],
    ["catalog_response_invalid", "Runnable LLM catalog returned invalid data."],
  ])("renders %s distinctly", (code, message) => {
    expect(runnableCatalogMessage({ code })).toBe(message);
  });
});

describe("LLM instance answer", () => {
  it("shows the beginning and keeps a long full answer available", () => {
    const output = `The verified answer starts here. ${"detail ".repeat(100)}`;
    const html = renderToStaticMarkup(
      <InstanceAnswer output={output} state="delivered" />,
    );

    expect(html).toContain("Instance answer · beginning");
    expect(html).toContain("The verified answer starts here.");
    expect(html).toContain("Show full answer");
    expect(answerPreview(output).length).toBeLessThan(output.length);
  });

  it("states when a terminal job has no saved answer", () => {
    const html = renderToStaticMarkup(
      <InstanceAnswer output={null} state="reconciliation_required" />,
    );

    expect(html).toContain("No instance answer was saved");
    expect(html).not.toContain("Instance answer · beginning");
  });
});
