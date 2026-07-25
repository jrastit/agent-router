import { readFileSync } from "node:fs";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

interface ComposeService {
  image: string;
  command?: string[];
  ports?: string[];
  environment?: Record<string, string>;
  volumes?: string[];
  depends_on?: Record<string, { condition: string }>;
  healthcheck?: {
    test: string[];
  };
}

interface ComposeFile {
  services: Record<string, ComposeService>;
  volumes: Record<string, unknown>;
}

const compose = parse(
  readFileSync("deploy/graph-node/compose.yaml", "utf8"),
) as ComposeFile;
const projection = parse(
  readFileSync("deploy/graph-node/compose.projection.yaml", "utf8"),
) as ComposeFile;

describe("production Graph Node Compose configuration", () => {
  it("pins every container image and persists state", () => {
    expect(Object.values(compose.services).map(({ image }) => image)).toEqual([
      "postgres:17.5-alpine",
      "ipfs/kubo:v0.42.0",
      "graphprotocol/graph-node:v0.44.0",
    ]);
    expect(
      Object.values(compose.services).every(
        ({ image }) => !image.endsWith(":latest"),
      ),
    ).toBe(true);
    expect(compose.volumes).toHaveProperty("graph-postgres-data");
    expect(compose.volumes).toHaveProperty("graph-ipfs-data");
  });

  it("keeps databases private and all operator ports on loopback", () => {
    expect(compose.services.postgres.ports).toBeUndefined();
    expect(compose.services.ipfs.ports).toEqual([
      "127.0.0.1:${GRAPH_IPFS_API_PORT:-5001}:5001",
    ]);
    expect(compose.services["graph-node"].ports).toHaveLength(5);
    expect(
      compose.services["graph-node"].ports?.every((port) =>
        port.startsWith("127.0.0.1:"),
      ),
    ).toBe(true);
  });

  it("requires secrets and Hedera RPC configuration at startup", () => {
    expect(compose.services.postgres.environment?.POSTGRES_PASSWORD).toContain(
      "GRAPH_POSTGRES_PASSWORD:?",
    );
    expect(compose.services["graph-node"].environment?.ethereum).toContain(
      "hedera-testnet:${HEDERA_EVM_RPC_URL:?",
    );
    expect(
      Object.values(compose.services).every(
        ({ healthcheck }) => healthcheck !== undefined,
      ),
    ).toBe(true);
  });

  it("uses a health-check client included in the Graph Node image", () => {
    expect(compose.services["graph-node"].healthcheck?.test).toEqual([
      "CMD",
      "nc",
      "-z",
      "127.0.0.1",
      "8030",
    ]);
  });
});

describe("local projection Graph Node override", () => {
  it("pins a quiet disposable Ganache on loopback", () => {
    expect(projection.services.ganache.image).toBe(
      "trufflesuite/ganache:v7.9.2",
    );
    expect(projection.services.ganache.ports).toEqual([
      "127.0.0.1:${LOCAL_EVM_PORT:-8545}:8545",
    ]);
    expect(projection.services.ganache.command).toEqual(
      expect.arrayContaining([
        "--chain.chainId=1337",
        "--wallet.totalAccounts=3",
        "--logging.quiet=true",
      ]),
    );
  });

  it("uses Compose service discovery for the exact Graph network name", () => {
    expect(projection.services["graph-node"].environment?.ethereum).toBe(
      "ganache-local:http://ganache:8545",
    );
    expect(
      projection.services["graph-node"].depends_on?.ganache.condition,
    ).toBe("service_started");
  });
});
