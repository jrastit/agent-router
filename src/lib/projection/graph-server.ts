import "server-only";

import { serverEnv } from "../env/server";
import { ProjectionGraphClient } from "./graph";

export const projectionGraph = new ProjectionGraphClient(
  serverEnv.HEDERA_PROJECTION_PUBLIC_QUERY_URL,
);
