import { readFile } from "node:fs/promises";

import { ContractFactory, JsonRpcProvider } from "ethers";
import solc from "solc";

const confirmation = "--confirm-local-ganache";
if (process.argv[2] !== confirmation) {
  throw new Error(`Pass ${confirmation} to deploy to the local Ganache chain`);
}

const rpcUrl = process.env.LOCAL_EVM_RPC_URL ?? "http://127.0.0.1:8545";
const rpc = new URL(rpcUrl);
if (!["127.0.0.1", "localhost", "::1"].includes(rpc.hostname)) {
  throw new Error("Refusing local deployment: RPC host must be loopback");
}

const expectedChainId = BigInt(process.env.LOCAL_EVM_CHAIN_ID ?? "1337");
const deployerIndex = Number(process.env.LOCAL_EVM_DEPLOYER_INDEX ?? "0");
const relayerIndex = Number(process.env.LOCAL_EVM_RELAYER_INDEX ?? "1");
if (
  !Number.isSafeInteger(deployerIndex) ||
  deployerIndex < 0 ||
  !Number.isSafeInteger(relayerIndex) ||
  relayerIndex < 0 ||
  deployerIndex === relayerIndex
) {
  throw new Error(
    "Deployer and relayer indexes must be distinct nonnegative integers",
  );
}

const source = await readFile(
  new URL("../contracts/HederaEventAnchor.sol", import.meta.url),
  "utf8",
);
const file = "HederaEventAnchor.sol";
const output = JSON.parse(
  solc.compile(
    JSON.stringify({
      language: "Solidity",
      sources: { [file]: { content: source } },
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
const errors = (output.errors ?? []).filter(
  (error) => error.severity === "error",
);
if (errors.length > 0) {
  throw new Error(errors.map((error) => error.formattedMessage).join("\n"));
}

const provider = new JsonRpcProvider(rpcUrl);
const network = await provider.getNetwork();
if (network.chainId !== expectedChainId) {
  throw new Error(
    `Refusing local deployment: expected chain ID ${expectedChainId}, RPC returned ${network.chainId}`,
  );
}

const deployer = await provider.getSigner(deployerIndex);
const relayer = await provider.getSigner(relayerIndex);
const relayerAddress = await relayer.getAddress();
const compiled = output.contracts[file].HederaEventAnchor;
const factory = new ContractFactory(
  compiled.abi,
  `0x${compiled.evm.bytecode.object}`,
  deployer,
);
const contract = await factory.deploy(relayerAddress);
const transaction = contract.deploymentTransaction();
if (!transaction) throw new Error("Deployment transaction was not created");
await contract.waitForDeployment();
const receipt = await transaction.wait(1);
if (!receipt || receipt.status !== 1) {
  throw new Error("Local deployment did not finalize successfully");
}

console.log(
  JSON.stringify(
    {
      network: "ganache-local",
      rpcUrl,
      chainId: network.chainId.toString(),
      contractAddress: await contract.getAddress(),
      deploymentTransaction: transaction.hash,
      blockNumber: receipt.blockNumber.toString(),
      deployer: await deployer.getAddress(),
      relayer: relayerAddress,
      compiler: solc.version(),
      evmVersion: "shanghai",
      authority:
        "relayer-mediated monitoring only; Hedera Mirror and Postgres remain authoritative",
    },
    null,
    2,
  ),
);
