import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import LlmJobPanel from "./llm-job-panel";

describe("LLM job panel", () => {
  it("requires sign-in and explains durable recovery", () => {
    const html = renderToStaticMarkup(<LlmJobPanel />);
    expect(html).toContain("Connect your account first");
    expect(html).toContain("persisted job");
    expect(html).toContain("Reserve credit and run");
  });

  it("shows token, spend, privacy, and output controls when signed in", () => {
    const html = renderToStaticMarkup(<LlmJobPanel accessToken="user-token" />);
    expect(html).toContain("Signed in");
    expect(html).toContain("Private prompt");
    expect(html).toContain("Max input tokens");
    expect(html).toContain("Spend ceiling");
    expect(html).not.toContain("user-token");
  });
});
