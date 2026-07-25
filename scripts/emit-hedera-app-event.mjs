import {
  Contract,
  JsonRpcProvider,
  Wallet,
  isAddress,
  isHexString,
} from "ethers";

const abi = [
  "function recordAppEvent(bytes32 eventId, bytes32 subject, string kind, bytes32 payloadDigest, uint16 version)",
  "event AppEventRecorded(bytes32 indexed eventId, bytes32 indexed subject, string kind, bytes32 payloadDigest, uint16 version)",
];

if (!process.argv.includes("--confirm-live-testnet")) {
  throw new Error(
    "Pass --confirm-live-testnet to emit a public app event on Hedera Testnet",
  );
}

const config = {
  rpcUrl: process.env.HEDERA_EVM_RPC_URL,
  privateKey: process.env.HEDERA_EVM_PRIVATE_KEY,
  contractAddress: process.env.HEDERA_APP_EVENT_CONTRACT_ADDRESS,
  eventId: process.env.HEDERA_APP_EVENT_ID,
  subject: process.env.HEDERA_APP_EVENT_SUBJECT,
  kind: process.env.HEDERA_APP_EVENT_KIND,
  payloadDigest: process.env.HEDERA_APP_EVENT_PAYLOAD_DIGEST,
};
if (!config.rpcUrl || !config.privateKey) {
  throw new Error("HEDERA_EVM_RPC_URL and HEDERA_EVM_PRIVATE_KEY are required");
}
if (!isAddress(config.contractAddress)) {
  throw new Error("HEDERA_APP_EVENT_CONTRACT_ADDRESS must be an EVM address");
}
for (const [name, value] of [
  ["HEDERA_APP_EVENT_ID", config.eventId],
  ["HEDERA_APP_EVENT_SUBJECT", config.subject],
  ["HEDERA_APP_EVENT_PAYLOAD_DIGEST", config.payloadDigest],
]) {
  if (!isHexString(value, 32)) {
    throw new Error(`${name} must be a precomputed 32-byte digest`);
  }
}
if (
  !config.kind ||
  Buffer.byteLength(config.kind, "utf8") > 64 ||
  Buffer.byteLength(config.kind, "utf8") === 0
) {
  throw new Error("HEDERA_APP_EVENT_KIND must contain 1 to 64 UTF-8 bytes");
}

const provider = new JsonRpcProvider(config.rpcUrl);
const network = await provider.getNetwork();
if (network.chainId !== 296n) {
  throw new Error(
    `Refusing event submission: expected chain ID 296, received ${network.chainId}`,
  );
}
const signer = new Wallet(config.privateKey, provider);
const journal = new Contract(config.contractAddress, abi, signer);
const transaction = await journal.recordAppEvent(
  config.eventId,
  config.subject,
  config.kind,
  config.payloadDigest,
  1,
);
const receipt = await transaction.wait(1);
if (!receipt || receipt.status !== 1) {
  throw new Error("app-event transaction did not finalize successfully");
}
const journalAddress = config.contractAddress.toLowerCase();
const log = receipt.logs.find(
  ({ address }) => address.toLowerCase() === journalAddress,
);
if (!log)
  throw new Error("finalized receipt did not contain the app event log");

process.stdout.write(
  `${JSON.stringify(
    {
      network: "hedera-testnet",
      chainId: network.chainId.toString(),
      contractAddress: config.contractAddress,
      transactionHash: transaction.hash,
      blockNumber: receipt.blockNumber,
      eventId: config.eventId,
      kind: config.kind,
      subject: config.subject,
      payloadDigest: config.payloadDigest,
      version: 1,
    },
    null,
    2,
  )}\n`,
);
