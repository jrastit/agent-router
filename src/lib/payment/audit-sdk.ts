import "server-only";

import {
  AccountId,
  Client,
  TopicId,
  TopicMessageSubmitTransaction,
} from "@hashgraph/sdk";

import { serverEnv } from "../env/server";
import { encodeAuditAnchor, type AuditAnchor } from "./audit";
import { parseHederaPrivateKey } from "./private-key";

export type PublishedAuditAnchor = {
  transactionId: string;
  topicId: string;
  sequenceNumber: string;
};

export async function publishAuditAnchor(
  anchor: AuditAnchor,
): Promise<PublishedAuditAnchor> {
  if (
    !serverEnv.HEDERA_OPERATOR_ID ||
    !serverEnv.HEDERA_OPERATOR_KEY ||
    !serverEnv.HEDERA_TOPIC_ID
  ) {
    throw new Error("Hedera operator and topic configuration is required");
  }
  const client = Client.forTestnet().setOperator(
    AccountId.fromString(serverEnv.HEDERA_OPERATOR_ID),
    parseHederaPrivateKey(serverEnv.HEDERA_OPERATOR_KEY),
  );
  try {
    const response = await new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(serverEnv.HEDERA_TOPIC_ID))
      .setMessage(encodeAuditAnchor(anchor))
      .execute(client);
    const receipt = await response.getReceipt(client);
    if (
      receipt.status.toString() !== "SUCCESS" ||
      !receipt.topicSequenceNumber
    ) {
      throw new Error(`HCS consensus status was ${receipt.status.toString()}`);
    }
    return {
      transactionId: response.transactionId.toString(),
      topicId: serverEnv.HEDERA_TOPIC_ID,
      sequenceNumber: receipt.topicSequenceNumber.toString(),
    };
  } finally {
    client.close();
  }
}
