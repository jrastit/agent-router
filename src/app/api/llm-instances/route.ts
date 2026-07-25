import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  readLlmInstanceCatalog,
  writeLlmInstanceCatalog,
} from "../../../lib/llm-instances/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await readLlmInstanceCatalog(), {
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "LLM instance catalog is unavailable" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  if (!authorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const saved = await writeLlmInstanceCatalog(await request.json());
    return NextResponse.json(saved, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid LLM instance catalog" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "LLM instance catalog could not be saved" },
      { status: 500 },
    );
  }
}

function authorized(header: string | null): boolean {
  const expected = process.env.LLM_INSTANCE_ADMIN_TOKEN;
  const supplied = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}
