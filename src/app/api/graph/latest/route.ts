import { NextResponse } from "next/server";

import { serverEnv } from "../../../../lib/env/server";
import { loadLatestGraphActivity } from "../../../../lib/projection/activity";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(
      await loadLatestGraphActivity(
        serverEnv.HEDERA_PROJECTION_PUBLIC_QUERY_URL,
      ),
    );
  } catch {
    return NextResponse.json(
      { error: "Latest Graph activity is temporarily unavailable." },
      { status: 503 },
    );
  }
}
