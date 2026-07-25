import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const bundleRoot = join(process.cwd(), ".next", "static");
const serverOnlyKeys = [
  "HEDERA_OPERATOR_KEY",
  "GRAPH_ACCESS_TOKEN",
  "SCALEWAY_GENAI_API_KEY",
  "G_API_KEY_PRIVATE",
  "G_API_KEY_MANAGEMENT",
  "ZG_STORAGE_PRIVATE_KEY",
  "ZG_CHAIN_PRIVATE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? filesUnder(path) : [path];
    }),
  );
  return nested.flat();
}

const configuredSecrets = serverOnlyKeys.flatMap((key) => {
  const value = process.env[key];
  return value && value.length >= 8 ? [{ key, value }] : [];
});

for (const path of await filesUnder(bundleRoot)) {
  const bundle = await readFile(path, "utf8");
  for (const key of serverOnlyKeys) {
    if (bundle.includes(key)) {
      throw new Error(
        `client bundle exposes server-only environment key ${key}`,
      );
    }
  }
  for (const secret of configuredSecrets) {
    if (bundle.includes(secret.value)) {
      throw new Error(
        `client bundle exposes configured value for ${secret.key}`,
      );
    }
  }
}

console.log(
  "Client bundles contain no server-only keys or configured secrets.",
);
