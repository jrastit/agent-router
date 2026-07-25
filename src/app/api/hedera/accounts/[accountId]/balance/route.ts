import { NextResponse } from "next/server";

import { fetchHederaBalance } from "../../../../../../lib/deposit/balance";
import { serverEnv } from "../../../../../../lib/env/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ accountId: string }> },
) {
  try {
    const { accountId } = await context.params;
    return NextResponse.json(
      await fetchHederaBalance(serverEnv.HEDERA_MIRROR_NODE_URL, accountId),
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const invalidAccount = error instanceof Error && error.name === "ZodError";
    return NextResponse.json(
      {
        error: invalidAccount
          ? "Invalid Hedera account"
          : "Balance unavailable",
      },
      { status: invalidAccount ? 400 : 502 },
    );
  }
}
