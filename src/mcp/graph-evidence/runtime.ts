import "server-only";

import { serverEnv } from "../../lib/env/server";
import { GraphPaymentEvidenceClient } from "./graph-client";

export function createServerGraphEvidenceClient() {
  return new GraphPaymentEvidenceClient({
    projectionEndpoint: serverEnv.HEDERA_PROJECTION_PUBLIC_QUERY_URL,
    economicEndpoint: serverEnv.HEDERA_ECONOMIC_PUBLIC_QUERY_URL,
  });
}
