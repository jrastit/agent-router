import { describe, expect, it } from "vitest";

import { demoJobId } from "../../../../../lib/workflow/demo-run";

import { GET } from "./route";

describe("workflow event stream", () => {
  it("streams persisted events in sequence order", async () => {
    const response = await GET(
      new Request(`http://localhost/api/workflows/${demoJobId}/events`),
      { params: Promise.resolve({ jobId: demoJobId }) },
    );
    const body = await response.text();

    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain("id: 0");
    expect(body).toContain("payment.consensus_confirmed");
    expect(body).toContain("receipt.recorded");
    expect(body).toContain("event: complete");
  });

  it("resumes strictly after the supplied cursor", async () => {
    const response = await GET(
      new Request(`http://localhost/api/workflows/${demoJobId}/events?after=5`),
      { params: Promise.resolve({ jobId: demoJobId }) },
    );
    const body = await response.text();

    expect(body).not.toContain("id: 5\n");
    expect(body).toContain("id: 6\n");
    expect(body).toContain("id: 7\n");
  });

  it("rejects unknown workflows and malformed cursors", async () => {
    const missing = await GET(
      new Request("http://localhost/api/workflows/missing/events"),
      { params: Promise.resolve({ jobId: "missing" }) },
    );
    const invalid = await GET(
      new Request(
        `http://localhost/api/workflows/${demoJobId}/events?after=nope`,
      ),
      { params: Promise.resolve({ jobId: demoJobId }) },
    );

    expect(missing.status).toBe(404);
    expect(invalid.status).toBe(400);
  });
});
