import { handleGraphEvidenceMcpHttp } from "../../../../mcp/graph-evidence/http";
import {
  createServerGraphEvidenceClient,
  createServerLlmMcpClient,
} from "../../../../mcp/graph-evidence/runtime";

export const dynamic = "force-dynamic";

function handle(request: Request) {
  const userAccessToken = request.headers
    .get("authorization")
    ?.match(/^Bearer ([^\s]+)$/)?.[1];
  return handleGraphEvidenceMcpHttp(
    request,
    createServerGraphEvidenceClient(),
    createServerLlmMcpClient(userAccessToken),
  );
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
