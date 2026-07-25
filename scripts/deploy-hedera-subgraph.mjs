import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { isAddress } from "ethers";

const contractAddress = process.env.HEDERA_APP_EVENT_CONTRACT_ADDRESS;
const startBlockText = process.env.HEDERA_APP_EVENT_START_BLOCK;
const adminUrl = process.env.GRAPH_NODE_ADMIN_URL ?? "http://127.0.0.1:8020";
const ipfsUrl = process.env.GRAPH_IPFS_URL ?? "http://127.0.0.1:5001";
const subgraphName =
  process.env.HEDERA_SUBGRAPH_NAME ?? "agent-router/app-events";
const versionLabel =
  process.env.HEDERA_SUBGRAPH_VERSION ?? new Date().toISOString().slice(0, 10);

function requireLoopbackUrl(name, value) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "::1"].includes(url.hostname)
  ) {
    throw new Error(`${name} must be a private loopback HTTP endpoint`);
  }
  return url.toString();
}

if (!process.argv.includes("--confirm-private-graph-node")) {
  throw new Error(
    "Pass --confirm-private-graph-node to deploy through private Graph Node ports",
  );
}
if (!isAddress(contractAddress)) {
  throw new Error("HEDERA_APP_EVENT_CONTRACT_ADDRESS must be an EVM address");
}
if (!/^(0|[1-9]\d*)$/.test(startBlockText ?? "")) {
  throw new Error("HEDERA_APP_EVENT_START_BLOCK must be an integer");
}
const startBlock = Number(startBlockText);
if (!Number.isSafeInteger(startBlock)) {
  throw new Error(
    "HEDERA_APP_EVENT_START_BLOCK exceeds JavaScript safe integer",
  );
}
const normalizedAdminUrl = requireLoopbackUrl("GRAPH_NODE_ADMIN_URL", adminUrl);
const normalizedIpfsUrl = requireLoopbackUrl("GRAPH_IPFS_URL", ipfsUrl);

const createResponse = await fetch(normalizedAdminUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "subgraph_create",
    params: { name: subgraphName },
  }),
});
if (!createResponse.ok) {
  throw new Error(
    `Graph Node admin API returned HTTP ${createResponse.status}`,
  );
}
const createBody = await createResponse.json();
const createError = createBody.error?.message;
if (createError && !/already exists/i.test(createError)) {
  throw new Error(`subgraph_create failed: ${createError}`);
}

const temporaryDirectory = await mkdtemp(join(tmpdir(), "agent-router-graph-"));
try {
  const networkFile = join(temporaryDirectory, "networks.json");
  await writeFile(
    networkFile,
    `${JSON.stringify(
      {
        "hedera-testnet": {
          HederaAppEventJournal: {
            address: contractAddress,
            startBlock,
          },
        },
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );

  const result = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "graph",
      "deploy",
      "--node",
      normalizedAdminUrl,
      "--ipfs",
      normalizedIpfsUrl,
      "--network",
      "hedera-testnet",
      "--network-file",
      networkFile,
      "--version-label",
      versionLabel,
      subgraphName,
      "graph/app-events/subgraph.yaml",
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) {
    throw new Error(`Graph CLI deployment exited with status ${result.status}`);
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

process.stdout.write(
  `${JSON.stringify(
    {
      subgraphName,
      network: "hedera-testnet",
      contractAddress,
      startBlock,
      queryUrl: `http://127.0.0.1:8000/subgraphs/name/${subgraphName}`,
      versionLabel,
    },
    null,
    2,
  )}\n`,
);
