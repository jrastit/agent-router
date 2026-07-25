import { readFile } from "node:fs/promises";

import {
  AccountId,
  Client,
  ContractCreateFlow,
  ContractFunctionParameters,
  PrivateKey,
} from "@hashgraph/sdk";
import solc from "solc";

if (!process.argv.includes("--confirm-live-testnet")) {
  throw new Error(
    "Pass --confirm-live-testnet to deploy the app-event contract with the Hedera operator",
  );
}

const operatorIdText = process.env.HEDERA_OPERATOR_ID;
const operatorKeyText = process.env.HEDERA_OPERATOR_KEY;
const rpcUrl =
  process.env.HEDERA_EVM_RPC_URL ?? "https://testnet.hashio.io/api";
if (!operatorIdText || !operatorKeyText) {
  throw new Error("HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY are required");
}

async function rpc(method, params = []) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) {
    throw new Error(`Hedera JSON-RPC Relay returned HTTP ${response.status}`);
  }
  const body = await response.json();
  if (body.error) {
    throw new Error(`Hedera JSON-RPC Relay error: ${body.error.message}`);
  }
  return body.result;
}

const chainId = BigInt(await rpc("eth_chainId"));
if (chainId !== 296n) {
  throw new Error(
    `Refusing deployment: Hedera Testnet chain ID is 296, RPC returned ${chainId}`,
  );
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
          "*": { "*": ["evm.bytecode.object"] },
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

const operatorId = AccountId.fromString(operatorIdText);
const operatorKey = /^0x[0-9a-fA-F]{64}$/.test(operatorKeyText)
  ? PrivateKey.fromStringECDSA(operatorKeyText.slice(2))
  : PrivateKey.fromString(operatorKeyText);
const publisher = operatorId.toSolidityAddress();
const bytecode =
  output.contracts[file].HederaAppEventJournal.evm.bytecode.object;
const client = Client.forTestnet().setOperator(operatorId, operatorKey);

let response;
let receipt;
try {
  response = await new ContractCreateFlow()
    .setBytecode(bytecode)
    .setGas(4_000_000)
    .setConstructorParameters(
      new ContractFunctionParameters().addAddress(publisher),
    )
    .setContractMemo("agent-router:app-event-journal:v1")
    .execute(client);
  receipt = await response.getReceipt(client);
} finally {
  client.close();
}
if (receipt.status.toString() !== "SUCCESS" || !receipt.contractId) {
  throw new Error(
    `contract deployment consensus status was ${receipt.status.toString()}`,
  );
}

const contractId = receipt.contractId;
const contractAddress = `0x${contractId.toSolidityAddress()}`;
let startBlock;
for (let attempt = 0; attempt < 30; attempt += 1) {
  const code = await rpc("eth_getCode", [contractAddress, "latest"]);
  if (code && code !== "0x") {
    startBlock = Number(BigInt(await rpc("eth_blockNumber")));
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 3_000));
}
if (startBlock === undefined) {
  throw new Error(
    "contract reached consensus but JSON-RPC indexing timed out; reconcile before deploying the Subgraph",
  );
}

process.stdout.write(
  `${JSON.stringify(
    {
      network: "hedera-testnet",
      chainId: chainId.toString(),
      contractId: contractId.toString(),
      contractAddress,
      publisher: `0x${publisher}`,
      deploymentTransaction: response.transactionId.toString(),
      startBlock,
      compiler: solc.version(),
      evmVersion: "paris",
      optimizerRuns: 200,
      hashscanContractUrl: `https://hashscan.io/testnet/contract/${contractId.toString()}`,
      hashscanTransactionUrl: `https://hashscan.io/testnet/transaction/${encodeURIComponent(response.transactionId.toString())}`,
    },
    null,
    2,
  )}\n`,
);
