import { describe, expect, it, vi } from "vitest";

import { createSupabaseLlmCatalogHandler } from "../../../lib/llm-instances/supabase-catalog";

describe("LLM instance catalog API", () => {
  it("exports the Supabase catalog without caching", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json([]));
    const response = await createSupabaseLlmCatalogHandler({
      supabaseUrl: "https://supabase.example.com",
      serviceRoleKey: "service-secret",
      fetcher,
    })();
    expect(await response.json()).toEqual({ version: 1, instances: [] });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
