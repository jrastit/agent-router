import { handleGraphEvidenceMcpHttp } from "../../../../mcp/graph-evidence/http";
import { createServerGraphEvidenceClient } from "../../../../mcp/graph-evidence/runtime";

export const dynamic = "force-dynamic";

function handle(request: Request) {
  return handleGraphEvidenceMcpHttp(request, createServerGraphEvidenceClient());
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
