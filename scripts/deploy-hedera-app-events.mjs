import { readFile } from "node:fs/promises";

import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";
import solc from "solc";

if (!process.argv.includes("--confirm-live-testnet")) {
  throw new Error(
    "Pass --confirm-live-testnet to deploy the app-event contract on Hedera Testnet",
  );
}

const rpcUrl = process.env.HEDERA_EVM_RPC_URL;
const privateKey = process.env.HEDERA_EVM_PRIVATE_KEY;
if (!rpcUrl || !privateKey) {
  throw new Error("HEDERA_EVM_RPC_URL and HEDERA_EVM_PRIVATE_KEY are required");
}

const source = await readFile(
  new URL("../contracts/HederaAppEventJournal.sol", import.meta.url),
  "utf8",
);
const file = "HederaAppEventJournal.sol";
const output = JSON.parse(
  solc.compile(
    JSON.stringify({
      language: "Solidity",
      sources: { [file]: { content: source } },
      settings: {
        evmVersion: "paris",
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
if (network.chainId !== 296n) {
  throw new Error(
    `Refusing deployment: Hedera Testnet chain ID is 296, RPC returned ${network.chainId}`,
  );
}

const signer = new Wallet(privateKey, provider);
const compiled = output.contracts[file].HederaAppEventJournal;
const factory = new ContractFactory(
  compiled.abi,
  `0x${compiled.evm.bytecode.object}`,
  signer,
);
const contract = await factory.deploy(signer.address);
const deployment = contract.deploymentTransaction();
if (!deployment) throw new Error("deployment transaction was not created");
await contract.waitForDeployment();
const receipt = await deployment.wait(1);
if (!receipt || receipt.status !== 1) {
  throw new Error(
    "app-event contract deployment did not finalize successfully",
  );
}

process.stdout.write(
  `${JSON.stringify(
    {
      network: "hedera-testnet",
      chainId: network.chainId.toString(),
      contractAddress: await contract.getAddress(),
      publisher: signer.address,
      deploymentTransaction: deployment.hash,
      startBlock: receipt.blockNumber,
      compiler: solc.version(),
      evmVersion: "paris",
      optimizerRuns: 200,
    },
    null,
    2,
  )}\n`,
);
