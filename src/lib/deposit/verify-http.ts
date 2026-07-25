import { tinybarsToHbar } from "../payment/challenge";
import {
  fetchAndVerifyMirrorProof,
  MirrorVerificationError,
} from "../payment/mirror";
import {
  createDepositObserved,
  DepositVerificationError,
  verifyDepositProof,
} from "./deposit";
import {
  creditVerifiedDeposit,
  DepositVerificationPersistenceError,
  loadOwnedSubmittedDeposit,
} from "./verification-persistence";

function bearerToken(request: Request): string | undefined {
  const match = /^Bearer ([^\s]+)$/.exec(
    request.headers.get("authorization") ?? "",
  );
  return match?.[1];
}

export function createDepositVerificationHandler(input: {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  mirrorNodeUrl: string;
  pseudonymSalt?: string;
  fetcher?: typeof fetch;
  now?: () => Date;
}) {
  return async (
    request: Request,
    context: { params: Promise<{ depositId: string }> },
  ) => {
    const userAccessToken = bearerToken(request);
    if (!userAccessToken) {
      return Response.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }
    if (!input.supabaseUrl || !input.serviceRoleKey || !input.pseudonymSalt) {
      return Response.json(
        { error: "Deposit verification unavailable" },
        { status: 503 },
      );
    }
    const { depositId } = await context.params;
    if (!depositId || depositId.length > 200) {
      return Response.json({ error: "Invalid deposit" }, { status: 400 });
    }
    const config = {
      supabaseUrl: input.supabaseUrl,
      serviceRoleKey: input.serviceRoleKey,
      userAccessToken,
      fetcher: input.fetcher,
    };

    try {
      const { intent, transactionId } = await loadOwnedSubmittedDeposit(
        config,
        depositId,
      );
      const challenge = {
        version: "1" as const,
        id: intent.id,
        quoteId: intent.id,
        payerAccount: intent.payerAccount,
        recipientAccount: intent.treasuryAccount,
        network: intent.network,
        asset: "HBAR" as const,
        amount: tinybarsToHbar(BigInt(intent.amountTinybars)),
        memo: intent.memo,
        expiresAt: intent.expiresAt,
      };
      const proof = await fetchAndVerifyMirrorProof(
        input.mirrorNodeUrl,
        transactionId,
        challenge,
        input.fetcher,
      );
      const verifiedAt = input.now?.() ?? new Date();
      verifyDepositProof(intent, proof, transactionId, verifiedAt);
      const observed = createDepositObserved({
        intent,
        transactionHash: transactionId,
        verifiedAt,
        pseudonymSalt: input.pseudonymSalt,
      });
      const balance = await creditVerifiedDeposit(config, {
        intent,
        transactionId,
        consensusTimestamp: proof.consensusTimestamp,
        observed,
      });
      return Response.json({
        depositId,
        transactionId,
        state: "credited",
        creditedExactlyOnce: true,
        balance,
      });
    } catch (error) {
      if (
        error instanceof MirrorVerificationError &&
        error.code === "MIRROR_PENDING"
      ) {
        return Response.json(
          { depositId, state: "mirror_pending" },
          { status: 202 },
        );
      }
      if (error instanceof DepositVerificationPersistenceError) {
        const status = error.operation === "load" ? 404 : 409;
        return Response.json(
          { error: "Deposit verification failed" },
          { status },
        );
      }
      if (
        error instanceof MirrorVerificationError ||
        error instanceof DepositVerificationError
      ) {
        return Response.json(
          { error: "Deposit proof rejected" },
          { status: 409 },
        );
      }
      return Response.json(
        { error: "Deposit verification unavailable" },
        { status: 502 },
      );
    }
  };
}
