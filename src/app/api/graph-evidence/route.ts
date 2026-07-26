import { createServerGraphEvidenceClient } from "../../../mcp/graph-evidence/runtime";
import { createGraphEvidenceWebHandler } from "../../../mcp/graph-evidence/web";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return createGraphEvidenceWebHandler(createServerGraphEvidenceClient())(
    request,
  );
}
