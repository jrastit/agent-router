import { readFileSync } from "node:fs";

import {
  BrowserProvider,
  ContractFactory,
  keccak256,
  toUtf8Bytes,
  type Eip1193Provider,
} from "ethers";
import ganache from "ganache";
import solc from "solc";
import { afterEach, describe, expect, it } from "vitest";

type GanacheProvider = Eip1193Provider & { disconnect(): void };

function compile() {
  const file = "HederaEventAnchor.sol";
  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: "Solidity",
        sources: {
          [file]: {
            content: readFileSync(`contracts/${file}`, "utf8"),
          },
        },
        settings: {
          evmVersion: "shanghai",
          optimizer: { enabled: true, runs: 200 },
          outputSelection: {
            "*": { "*": ["abi", "evm.bytecode.object"] },
          },
        },
      }),
    ),
  );
  return output.contracts[file].HederaEventAnchor;
}

describe("HederaEventAnchor on local Ganache", () => {
  const local = ganache.provider({
    chain: { chainId: 1337 },
    logging: { quiet: true },
    wallet: { totalAccounts: 3 },
  }) as unknown as GanacheProvider;

  afterEach(() => local.disconnect());

  it("allows only the configured relayer and rejects source replay", async () => {
    const provider = new BrowserProvider(local);
    provider.pollingInterval = 10;
    expect((await provider.getNetwork()).chainId).toBe(BigInt(1337));
    const deployer = await provider.getSigner(0);
    const relayer = await provider.getSigner(1);
    const outsider = await provider.getSigner(2);
    const compiled = compile();
    const factory = new ContractFactory(
      compiled.abi,
      `0x${compiled.evm.bytecode.object}`,
      deployer,
    );
    const contract = await factory.deploy(await relayer.getAddress());
    await contract.waitForDeployment();

    const sourceEventId = keccak256(toUtf8Bytes("source-event"));
    const args = [
      sourceEventId,
      1,
      "0.0.7001",
      keccak256(toUtf8Bytes("hedera-transaction")),
      "1721234567.123456789",
      2,
      "deposit.observed",
      keccak256(toUtf8Bytes("public-payload")),
      1,
    ] as const;

    await expect(
      contract.connect(outsider).getFunction("anchorHederaEvent")(...args),
    ).rejects.toThrow();
    await (
      await contract.connect(relayer).getFunction("anchorHederaEvent")(...args)
    ).wait();
    expect(await contract.getFunction("anchored")(sourceEventId)).toBe(true);
    await expect(
      (async () => {
        const replay = await contract
          .connect(relayer)
          .getFunction("anchorHederaEvent")(...args);
        await replay.wait();
      })(),
    ).rejects.toThrow();
  }, 15_000);
});
