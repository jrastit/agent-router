import { readFile } from "node:fs/promises";

import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";
import solc from "solc";

if (process.argv[2] !== "--confirm-live-testnet") {
  throw new Error("Pass --confirm-live-testnet to deploy");
}

const rpcUrl = process.env.ZG_CHAIN_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
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
      network: "0g-galileo-testnet",
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
