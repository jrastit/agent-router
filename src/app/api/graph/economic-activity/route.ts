import { NextResponse } from "next/server";

import { serverEnv } from "../../../../lib/env/server";
import { loadEconomicActivity } from "../../../../lib/projection/economic-activity";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(
      await loadEconomicActivity(serverEnv.HEDERA_ECONOMIC_PUBLIC_QUERY_URL),
    );
  } catch {
    return NextResponse.json(
      { error: "User fund activity is temporarily unavailable." },
      { status: 503 },
    );
  }
}
