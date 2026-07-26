import {
  createServerGraphEvidenceClient,
  createServerLlmMcpClient,
} from "../../../mcp/graph-evidence/runtime";
import { createGraphEvidenceWebHandler } from "../../../mcp/graph-evidence/web";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userAccessToken = request.headers
    .get("authorization")
    ?.match(/^Bearer ([^\s]+)$/)?.[1];
  return createGraphEvidenceWebHandler(
    createServerGraphEvidenceClient(),
    createServerLlmMcpClient(userAccessToken),
  )(request);
}
