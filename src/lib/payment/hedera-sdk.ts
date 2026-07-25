import "server-only";

import {
  AccountId,
  Client,
  Hbar,
  PrivateKey,
  TransferTransaction,
} from "@hashgraph/sdk";

import { serverEnv } from "../env/server";
import type { HederaTransferTransport } from "./hedera";

export function createHederaTransferTransport(): HederaTransferTransport {
  if (!serverEnv.HEDERA_OPERATOR_ID || !serverEnv.HEDERA_OPERATOR_KEY) {
    throw new Error("Hedera operator credentials are not configured");
  }
  const operatorId = AccountId.fromString(serverEnv.HEDERA_OPERATOR_ID);
  const operatorKey = PrivateKey.fromString(serverEnv.HEDERA_OPERATOR_KEY);
  const client = Client.forTestnet().setOperator(operatorId, operatorKey);

  return {
    async submit(input) {
      if (input.payerAccount !== operatorId.toString()) {
        throw new Error("challenge payer does not match configured operator");
      }
      const response = await new TransferTransaction()
        .addHbarTransfer(
          AccountId.fromString(input.payerAccount),
          Hbar.fromTinybars((-input.amountTinybars).toString()),
        )
        .addHbarTransfer(
          AccountId.fromString(input.recipientAccount),
          Hbar.fromTinybars(input.amountTinybars.toString()),
        )
        .setTransactionMemo(input.memo)
        .execute(client);

      return {
        transactionId: response.transactionId.toString(),
        async waitForConsensus() {
          const receipt = await response.getReceipt(client);
          return { status: receipt.status.toString() };
        },
      };
    },
  };
}
