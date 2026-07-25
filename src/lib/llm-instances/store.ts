import "server-only";

import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { llmInstanceCatalogSchema, type LlmInstanceCatalog } from "./schema";

export const defaultLlmInstanceCatalogPath = path.join(
  process.cwd(),
  "data",
  "llm-instances.json",
);

export async function readLlmInstanceCatalog(
  filePath = defaultLlmInstanceCatalogPath,
): Promise<LlmInstanceCatalog> {
  const contents = await readFile(filePath, "utf8");
  return llmInstanceCatalogSchema.parse(JSON.parse(contents));
}

export async function writeLlmInstanceCatalog(
  catalog: unknown,
  filePath = defaultLlmInstanceCatalogPath,
): Promise<LlmInstanceCatalog> {
  const validated = llmInstanceCatalogSchema.parse(catalog);
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(
    temporaryPath,
    `${JSON.stringify(validated, null, 2)}\n`,
    "utf8",
  );
  await rename(temporaryPath, filePath);
  return validated;
}
