import { createHash } from "node:crypto";

import {
  AccountId,
  Client,
  Hbar,
  PrivateKey,
  TopicId,
  TopicMessageSubmitTransaction,
} from "@hashgraph/sdk";

const transactionId = process.argv[2];
if (!transactionId) throw new Error("transaction ID argument is required");
const normalizedId = transactionId.replace("@", "-").replace(/\.(?=\d+$)/, "-");
const mirrorBase =
  process.env.HEDERA_MIRROR_NODE_URL ?? "https://testnet.mirrornode.hedera.com";
const response = await fetch(
  `${mirrorBase}/api/v1/transactions/${normalizedId}`,
  { headers: { accept: "application/json" } },
);
if (!response.ok)
  throw new Error(`mirror node returned HTTP ${response.status}`);
const body = await response.json();
const transaction = body.transactions?.find(
  ({ transaction_id }) => transaction_id === normalizedId,
);
if (
  !transaction ||
  transaction.name !== "CRYPTOTRANSFER" ||
  transaction.result !== "SUCCESS"
) {
  throw new Error("transaction is not a successful HBAR transfer");
}

const operatorIdText = process.env.HEDERA_OPERATOR_ID;
const operatorKeyText = process.env.HEDERA_OPERATOR_KEY;
const recipientIdText = process.env.HEDERA_RECIPIENT_ID;
const amountText = process.env.HEDERA_TRANSFER_HBAR;
const topicIdText = process.env.HEDERA_TOPIC_ID;
if (
  !operatorIdText ||
  !operatorKeyText ||
  !recipientIdText ||
  !amountText ||
  !topicIdText
) {
  throw new Error("Hedera live testnet configuration is incomplete");
}
const memo = Buffer.from(transaction.memo_base64, "base64").toString("utf8");
const runId = memo.startsWith("agent-router:")
  ? memo.slice("agent-router:".length)
  : undefined;
const expectedTinybars = new Hbar(amountText).toTinybars().toBigInt();
const recipientCredit = transaction.transfers
  .filter(({ account }) => account === recipientIdText)
  .reduce((sum, { amount }) => sum + BigInt(amount), BigInt(0));
const payerDebit = transaction.transfers
  .filter(({ account }) => account === operatorIdText)
  .reduce((sum, { amount }) => sum + BigInt(amount), BigInt(0));
if (
  !runId ||
  recipientCredit !== expectedTinybars ||
  payerDebit > -expectedTinybars
) {
  throw new Error("mirror proof does not match configured payment binding");
}

const topicMessagesResponse = await fetch(
  `${mirrorBase}/api/v1/topics/${topicIdText}/messages?limit=100&order=desc`,
);
if (!topicMessagesResponse.ok) {
  throw new Error(`topic lookup returned HTTP ${topicMessagesResponse.status}`);
}
const topicMessages = (await topicMessagesResponse.json()).messages ?? [];
const decodedMessages = topicMessages.flatMap((message) => {
  try {
    return [
      {
        sequenceNumber: String(message.sequence_number),
        value: JSON.parse(
          Buffer.from(message.message, "base64").toString("utf8"),
        ),
      },
    ];
  } catch {
    return [];
  }
});
const jobId = `phase6-${runId}`;
const decisionAnchor = decodedMessages.find(
  ({ value }) => value.kind === "decision" && value.jobId === jobId,
);
if (!decisionAnchor) throw new Error("matching decision anchor was not found");

let receiptAnchor = decodedMessages.find(
  ({ value }) =>
    value.kind === "receipt" && value.transactionId === transactionId,
);
if (!receiptAnchor) {
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        amountTinybars: expectedTinybars.toString(),
        consensusTimestamp: transaction.consensus_timestamp,
      }),
    )
    .digest("hex");
  const anchor = {
    version: "1",
    kind: "receipt",
    jobId,
    receiptId: `receipt-${runId}`,
    transactionId,
    receiptDigest: digest,
    occurredAt: new Date().toISOString(),
  };
  const client = Client.forTestnet().setOperator(
    AccountId.fromString(operatorIdText),
    /^0x[0-9a-fA-F]{64}$/.test(operatorKeyText)
      ? PrivateKey.fromStringECDSA(operatorKeyText.slice(2))
      : PrivateKey.fromString(operatorKeyText),
  );
  try {
    const submit = await new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicIdText))
      .setMessage(JSON.stringify(anchor))
      .execute(client);
    const receipt = await submit.getReceipt(client);
    if (
      receipt.status.toString() !== "SUCCESS" ||
      !receipt.topicSequenceNumber
    ) {
      throw new Error(`HCS consensus status was ${receipt.status.toString()}`);
    }
    receiptAnchor = {
      sequenceNumber: receipt.topicSequenceNumber.toString(),
      value: anchor,
      transactionId: submit.transactionId.toString(),
    };
  } finally {
    client.close();
  }
}

process.stdout.write(
  `${JSON.stringify(
    {
      runId,
      network: "testnet",
      paymentTransactionId: transactionId,
      paymentConsensusTimestamp: transaction.consensus_timestamp,
      decisionAnchorSequence: decisionAnchor.sequenceNumber,
      receiptAnchorSequence: receiptAnchor.sequenceNumber,
      receiptAnchorTransactionId: receiptAnchor.transactionId,
      topicId: topicIdText,
      hashscanTransactionUrl: `https://hashscan.io/testnet/transaction/${encodeURIComponent(transactionId)}`,
      hashscanTopicUrl: `https://hashscan.io/testnet/topic/${encodeURIComponent(topicIdText)}`,
    },
    null,
    2,
  )}\n`,
);
