import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { readLlmInstanceCatalog, writeLlmInstanceCatalog } from "./store";

const catalog = {
  version: 1,
  instances: [
    {
      id: "model-one",
      name: "Model One",
      provider: "provider",
      model: "model-v1",
      baseUrl: "https://models.example.com/v1",
      capabilities: ["chat"],
      privacy: "public",
      enabled: true,
      expectedLatencyMs: 100,
    },
  ],
} as const;

describe("LLM instance catalog store", () => {
  it("writes formatted JSON atomically and reads it back", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "llm-catalog-"));
    const filePath = path.join(directory, "instances.json");

    await writeLlmInstanceCatalog(catalog, filePath);

    expect(await readLlmInstanceCatalog(filePath)).toEqual(catalog);
    expect(await readFile(filePath, "utf8")).toContain('"instances": [');
  });

  it("rejects duplicate IDs and secret-like extra fields", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "llm-catalog-"));
    const filePath = path.join(directory, "instances.json");
    await expect(
      writeLlmInstanceCatalog(
        {
          ...catalog,
          instances: [
            catalog.instances[0],
            { ...catalog.instances[0], apiKey: "must-not-be-stored" },
          ],
        },
        filePath,
      ),
    ).rejects.toThrow();
  });
});
