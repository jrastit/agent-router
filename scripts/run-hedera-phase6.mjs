import { createHash, randomUUID } from "node:crypto";

import {
  AccountId,
  Client,
  Hbar,
  PrivateKey,
  TopicId,
  TopicMessageSubmitTransaction,
  TransferTransaction,
} from "@hashgraph/sdk";

if (!process.argv.includes("--confirm-live-testnet")) {
  throw new Error(
    "refusing live settlement without --confirm-live-testnet; every run creates a new payment",
  );
}

const [
  operatorIdText,
  operatorKeyText,
  recipientIdText,
  amountText,
  topicIdText,
] = [
  process.env.HEDERA_OPERATOR_ID,
  process.env.HEDERA_OPERATOR_KEY,
  process.env.HEDERA_RECIPIENT_ID,
  process.env.HEDERA_TRANSFER_HBAR,
  process.env.HEDERA_TOPIC_ID,
];
if (
  !operatorIdText ||
  !operatorKeyText ||
  !recipientIdText ||
  !amountText ||
  !topicIdText
) {
  throw new Error("Hedera live testnet configuration is incomplete");
}
if (!/^(0|[1-9]\d*)(\.\d{1,8})?$/.test(amountText)) {
  throw new Error(
    "HEDERA_TRANSFER_HBAR must be an exact positive HBAR decimal",
  );
}
if (BigInt(amountText.replace(".", "").padEnd(9, "0")) <= BigInt(0)) {
  throw new Error("HEDERA_TRANSFER_HBAR must be greater than zero");
}

const runId = randomUUID();
const jobId = `phase6-${runId}`;
const quoteId = `quote-${runId}`;
const decisionId = `decision-${runId}`;
const receiptId = `receipt-${runId}`;
const memo = `agent-router:${runId}`;
const occurredAt = new Date().toISOString();
const operatorId = AccountId.fromString(operatorIdText);
const recipientId = AccountId.fromString(recipientIdText);
const topicId = TopicId.fromString(topicIdText);
const client = Client.forTestnet().setOperator(
  operatorId,
  /^0x[0-9a-fA-F]{64}$/.test(operatorKeyText)
    ? PrivateKey.fromStringECDSA(operatorKeyText.slice(2))
    : PrivateKey.fromString(operatorKeyText),
);

const digest = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const submitAnchor = async (anchor) => {
  const response = await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(JSON.stringify(anchor))
    .execute(client);
  const receipt = await response.getReceipt(client);
  if (receipt.status.toString() !== "SUCCESS" || !receipt.topicSequenceNumber) {
    throw new Error(`HCS consensus status was ${receipt.status.toString()}`);
  }
  return {
    transactionId: response.transactionId.toString(),
    sequenceNumber: receipt.topicSequenceNumber.toString(),
  };
};

let paymentTransactionId;
try {
  const decisionAnchor = await submitAnchor({
    version: "1",
    kind: "decision",
    jobId,
    decisionId,
    quoteId,
    policyDigest: digest({ network: "testnet", asset: "HBAR" }),
    decisionDigest: digest({ recipient: recipientIdText, amount: amountText }),
    occurredAt,
  });

  const transferResponse = await new TransferTransaction()
    .addHbarTransfer(operatorId, new Hbar(amountText).negated())
    .addHbarTransfer(recipientId, new Hbar(amountText))
    .setTransactionMemo(memo)
    .execute(client);
  paymentTransactionId = transferResponse.transactionId.toString();
  const transferReceipt = await transferResponse.getReceipt(client);
  if (transferReceipt.status.toString() !== "SUCCESS") {
    throw new Error(
      `payment consensus status was ${transferReceipt.status.toString()}`,
    );
  }

  const mirrorBase =
    process.env.HEDERA_MIRROR_NODE_URL ??
    "https://testnet.mirrornode.hedera.com";
  let mirrorTransaction;
  const mirrorTransactionId = paymentTransactionId
    .replace("@", "-")
    .replace(/\.(?=\d+$)/, "-");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(
      `${mirrorBase}/api/v1/transactions/${mirrorTransactionId}`,
      { headers: { accept: "application/json" } },
    );
    if (response.ok) {
      const body = await response.json();
      mirrorTransaction = body.transactions?.find(
        ({ result, name }) => result === "SUCCESS" && name === "CRYPTOTRANSFER",
      );
      if (mirrorTransaction) break;
    } else if (response.status !== 404) {
      throw new Error(`mirror node returned HTTP ${response.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  if (!mirrorTransaction) {
    throw new Error("mirror verification timed out; reconciliation required");
  }
  const decodedMemo = Buffer.from(
    mirrorTransaction.memo_base64,
    "base64",
  ).toString("utf8");
  const recipientCredit = mirrorTransaction.transfers
    .filter(({ account }) => account === recipientIdText)
    .reduce((sum, { amount }) => sum + BigInt(amount), BigInt(0));
  const expectedTinybars = new Hbar(amountText).toTinybars().toBigInt();
  if (
    decodedMemo !== memo ||
    recipientCredit !== expectedTinybars ||
    mirrorTransaction.transaction_id !== mirrorTransactionId
  ) {
    throw new Error("mirror proof did not match the submitted payment");
  }

  const receiptAnchor = await submitAnchor({
    version: "1",
    kind: "receipt",
    jobId,
    receiptId,
    transactionId: paymentTransactionId,
    receiptDigest: digest({
      amountTinybars: expectedTinybars.toString(),
      consensusTimestamp: mirrorTransaction.consensus_timestamp,
    }),
    occurredAt: new Date().toISOString(),
  });

  process.stdout.write(
    `${JSON.stringify(
      {
        runId,
        network: "testnet",
        paymentTransactionId,
        paymentConsensusTimestamp: mirrorTransaction.consensus_timestamp,
        decisionAnchor,
        receiptAnchor,
        topicId: topicIdText,
        hashscanTransactionUrl: `https://hashscan.io/testnet/transaction/${encodeURIComponent(paymentTransactionId)}`,
        hashscanTopicUrl: `https://hashscan.io/testnet/topic/${encodeURIComponent(topicIdText)}`,
      },
      null,
      2,
    )}\n`,
  );
} catch (error) {
  process.stderr.write(
    `${JSON.stringify({
      status: paymentTransactionId
        ? "reconciliation_required"
        : "failed_before_payment_submission",
      paymentTransactionId,
      message: error instanceof Error ? error.message : "unknown failure",
    })}\n`,
  );
  process.exitCode = 1;
} finally {
  client.close();
}
