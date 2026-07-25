import { readFile } from "node:fs/promises";

import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";
import solc from "solc";

const networks = {
  "0g-galileo-testnet": {
    chainId: 16602n,
    confirmation: "--confirm-live-testnet",
    defaultRpcUrl: "https://evmrpc-testnet.0g.ai",
  },
  "0g-aristotle-mainnet": {
    chainId: 16661n,
    confirmation: "--confirm-live-mainnet",
    defaultRpcUrl: "https://evmrpc.0g.ai",
  },
};
const networkName = process.env.ZG_CHAIN_NETWORK ?? "0g-galileo-testnet";
const networkConfig = networks[networkName];
if (!networkConfig) {
  throw new Error(`Unsupported ZG_CHAIN_NETWORK: ${networkName}`);
}
if (process.argv[2] !== networkConfig.confirmation) {
  throw new Error(
    `Pass ${networkConfig.confirmation} to deploy on ${networkName}`,
  );
}

const rpcUrl = process.env.ZG_CHAIN_RPC_URL ?? networkConfig.defaultRpcUrl;
const privateKey = process.env.ZG_CHAIN_PRIVATE_KEY;
if (!privateKey) throw new Error("ZG_CHAIN_PRIVATE_KEY is required");

const source = await readFile(
  new URL("../contracts/ZgRoutingProvenance.sol", import.meta.url),
  "utf8",
);
const file = "ZgRoutingProvenance.sol";
const output = JSON.parse(
  solc.compile(
    JSON.stringify({
      language: "Solidity",
      sources: { [file]: { content: source } },
      settings: {
        evmVersion: "cancun",
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

const compiled = output.contracts[file].ZgRoutingProvenance;
const provider = new JsonRpcProvider(rpcUrl);
const signer = new Wallet(privateKey, provider);
const network = await provider.getNetwork();
if (network.chainId !== networkConfig.chainId) {
  throw new Error(
    `Refusing deployment: ${networkName} requires chain ID ${networkConfig.chainId}, RPC returned ${network.chainId}`,
  );
}
const factory = new ContractFactory(
  compiled.abi,
  `0x${compiled.evm.bytecode.object}`,
  signer,
);
const contract = await factory.deploy();
const deployment = contract.deploymentTransaction();
if (!deployment) throw new Error("Deployment transaction was not created");
await contract.waitForDeployment();
const receipt = await deployment.wait(1);
if (!receipt || receipt.status !== 1) {
  throw new Error("Deployment did not finalize successfully");
}

console.log(
  JSON.stringify(
    {
      network: networkName,
      chainId: network.chainId.toString(),
      contractAddress: await contract.getAddress(),
      deploymentTransaction: deployment.hash,
      blockNumber: receipt.blockNumber.toString(),
      compiler: solc.version(),
      evmVersion: "cancun",
    },
    null,
    2,
  ),
);
