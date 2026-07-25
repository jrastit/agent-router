import {
  Contract,
  JsonRpcProvider,
  Wallet,
  isAddress,
  isHexString,
} from "ethers";

const abi = [
  "function recordEconomicEvent(bytes32 eventId, bytes32 subject, uint8 eventType, int64 amountTinybars, bytes32 referenceId, bytes32 payloadDigest, uint16 version)",
  "event EconomicEventRecorded(bytes32 indexed eventId, bytes32 indexed subject, uint8 indexed eventType, int64 amountTinybars, bytes32 referenceId, bytes32 payloadDigest, uint16 version)",
];
const eventTypes = {
  1: "deposit_observed",
  2: "balance_credited",
  3: "balance_debited",
  4: "credit_reserved",
  5: "execution_charged",
  6: "balance_refunded",
  7: "reconciliation_opened",
};

if (!process.argv.includes("--confirm-live-testnet")) {
  throw new Error(
    "Pass --confirm-live-testnet to emit a public economic event on Hedera Testnet",
  );
}

const config = {
  rpcUrl: process.env.HEDERA_EVM_RPC_URL,
  privateKey: process.env.HEDERA_EVM_PRIVATE_KEY,
  contractAddress: process.env.HEDERA_APP_EVENT_CONTRACT_ADDRESS,
  eventId: process.env.HEDERA_APP_EVENT_ID,
  subject: process.env.HEDERA_APP_EVENT_SUBJECT,
  eventType: process.env.HEDERA_ECONOMIC_EVENT_TYPE,
  amountTinybars: process.env.HEDERA_ECONOMIC_AMOUNT_TINYBARS,
  referenceId: process.env.HEDERA_ECONOMIC_REFERENCE_ID,
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
  ["HEDERA_ECONOMIC_REFERENCE_ID", config.referenceId],
  ["HEDERA_APP_EVENT_PAYLOAD_DIGEST", config.payloadDigest],
]) {
  if (!isHexString(value, 32)) {
    throw new Error(`${name} must be a precomputed 32-byte digest`);
  }
}
if (!/^[1-7]$/.test(config.eventType ?? "")) {
  throw new Error("HEDERA_ECONOMIC_EVENT_TYPE must be an integer from 1 to 7");
}
if (!/^-?(0|[1-9]\d*)$/.test(config.amountTinybars ?? "")) {
  throw new Error(
    "HEDERA_ECONOMIC_AMOUNT_TINYBARS must be an exact signed integer",
  );
}
const amountTinybars = BigInt(config.amountTinybars);
if (
  amountTinybars < -(2n ** 63n) ||
  amountTinybars > 2n ** 63n - 1n ||
  (config.eventType !== "7" && amountTinybars === 0n)
) {
  throw new Error(
    "economic amount must fit int64 and be nonzero outside reconciliation",
  );
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
const transaction = await journal.recordEconomicEvent(
  config.eventId,
  config.subject,
  Number(config.eventType),
  amountTinybars,
  config.referenceId,
  config.payloadDigest,
  1,
);
const receipt = await transaction.wait(1);
if (!receipt || receipt.status !== 1) {
  throw new Error("economic event transaction did not finalize successfully");
}
const journalAddress = config.contractAddress.toLowerCase();
const log = receipt.logs.find(
  ({ address }) => address.toLowerCase() === journalAddress,
);
if (!log) {
  throw new Error("finalized receipt did not contain the economic event log");
}

process.stdout.write(
  `${JSON.stringify(
    {
      network: "hedera-testnet",
      chainId: network.chainId.toString(),
      contractAddress: config.contractAddress,
      transactionHash: transaction.hash,
      blockNumber: receipt.blockNumber,
      eventId: config.eventId,
      subject: config.subject,
      eventType: Number(config.eventType),
      eventKind: eventTypes[config.eventType],
      amountTinybars: amountTinybars.toString(),
      referenceId: config.referenceId,
      payloadDigest: config.payloadDigest,
      version: 1,
    },
    null,
    2,
  )}\n`,
);
