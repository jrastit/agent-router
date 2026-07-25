import {
  demoJobId,
  demoWorkflowEvents,
} from "../../../../../lib/workflow/demo-run";

export const dynamic = "force-dynamic";

function eventStreamRecord(event: (typeof demoWorkflowEvents)[number]) {
  return `id: ${event.sequence}\nevent: workflow\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params;
  if (jobId !== demoJobId) {
    return Response.json({ error: "Workflow not found" }, { status: 404 });
  }

  const requestUrl = new URL(request.url);
  const cursorValue =
    request.headers.get("last-event-id") ??
    requestUrl.searchParams.get("after");
  const cursor = cursorValue === null ? -1 : Number(cursorValue);
  if (!Number.isInteger(cursor) || cursor < -1) {
    return Response.json({ error: "Invalid event cursor" }, { status: 400 });
  }

  const body = demoWorkflowEvents
    .filter((event) => event.sequence > cursor)
    .map(eventStreamRecord)
    .join("");

  return new Response(`${body}event: complete\ndata: {}\n\n`, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
