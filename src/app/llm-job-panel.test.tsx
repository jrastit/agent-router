import { describe, expect, it } from "vitest";

import { runnableCatalogMessage } from "./llm-job-panel";

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
