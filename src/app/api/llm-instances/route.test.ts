import { beforeEach, describe, expect, it, vi } from "vitest";

const readLlmInstanceCatalog = vi.fn();
const writeLlmInstanceCatalog = vi.fn();

vi.mock("../../../lib/llm-instances/store", () => ({
  readLlmInstanceCatalog,
  writeLlmInstanceCatalog,
}));

describe("LLM instance catalog API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.LLM_INSTANCE_ADMIN_TOKEN = "test-admin-token";
  });

  it("exports the server catalog without caching", async () => {
    const catalog = { version: 1, instances: [] };
    readLlmInstanceCatalog.mockResolvedValue(catalog);
    const { GET } = await import("./route");
    const response = await GET();
    expect(await response.json()).toEqual(catalog);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("requires authorization before importing", async () => {
    const { PUT } = await import("./route");
    const response = await PUT(
      new Request("http://localhost/api/llm-instances", {
        method: "PUT",
        body: JSON.stringify({ version: 1, instances: [] }),
      }),
    );
    expect(response.status).toBe(401);
    expect(writeLlmInstanceCatalog).not.toHaveBeenCalled();
  });

  it("imports a catalog with the configured token", async () => {
    const catalog = { version: 1, instances: [] };
    writeLlmInstanceCatalog.mockResolvedValue(catalog);
    const { PUT } = await import("./route");
    const response = await PUT(
      new Request("http://localhost/api/llm-instances", {
        method: "PUT",
        headers: {
          authorization: "Bearer test-admin-token",
          "content-type": "application/json",
        },
        body: JSON.stringify(catalog),
      }),
    );
    expect(response.status).toBe(200);
    expect(writeLlmInstanceCatalog).toHaveBeenCalledWith(catalog);
  });
});
