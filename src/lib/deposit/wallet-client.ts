"use client";

import type { AppKit } from "@reown/appkit";

import type { DepositWalletReview } from "./wallet";
import { assertWalletCanSign, parseWalletTransactionId } from "./wallet";

type WalletConnection = {
  accountId: string;
  disconnect(): Promise<void>;
  signAndExecute(review: DepositWalletReview): Promise<string>;
};

type WalletRuntime = {
  appKit: AppKit;
  provider: import("@hashgraph/hedera-wallet-connect/dist/reown/providers/HederaProvider").HederaProvider;
  optionalNamespaces: unknown;
};

let runtimePromise: Promise<WalletRuntime> | undefined;

type RestorableHederaProvider = {
  session?: unknown;
  nativeProvider?: unknown;
  connect(params: {
    optionalNamespaces: unknown;
    skipPairing: boolean;
  }): Promise<unknown>;
};

export async function initializeRestoredHederaProvider(
  provider: RestorableHederaProvider,
  optionalNamespaces: unknown,
): Promise<void> {
  if (provider.session && !provider.nativeProvider) {
    await provider.connect({ optionalNamespaces, skipPairing: true });
  }
}

async function getRuntime(projectId: string): Promise<WalletRuntime> {
  runtimePromise ??= (async () => {
    const [{ createAppKit }, { HederaAdapter }, { HederaProvider }, chains] =
      await Promise.all([
        import("@reown/appkit"),
        import("@hashgraph/hedera-wallet-connect/dist/reown/adapter"),
        import("@hashgraph/hedera-wallet-connect/dist/reown/providers/HederaProvider"),
        import("@hashgraph/hedera-wallet-connect/dist/reown/utils/chains"),
      ]);
    const { createNamespaces, HederaChainDefinition, hederaNamespace } = chains;
    const network = HederaChainDefinition.Native.Testnet;
    const optionalNamespaces = createNamespaces([network]);
    const metadata = {
      name: "AgentRouter",
      description: "User-funded AgentRouter deposit",
      url: window.location.origin,
      icons: [`${window.location.origin}/favicon.ico`],
    };
    const adapter = new HederaAdapter({
      projectId,
      networks: [network],
      namespace: hederaNamespace,
      namespaceMode: "required",
    });
    const provider = await HederaProvider.init({ projectId, metadata });
    await initializeRestoredHederaProvider(provider, optionalNamespaces);
    const appKit = createAppKit({
      adapters: [adapter],
      universalProvider: provider,
      projectId,
      metadata,
      networks: [network],
      defaultNetwork: network,
      themeMode: "dark",
      features: {
        analytics: false,
        email: false,
        socials: false,
      },
    });
    return { appKit, provider, optionalNamespaces };
  })();

  return runtimePromise;
}

function connectedAccount(
  provider: WalletRuntime["provider"],
): string | undefined {
  if (!provider.session) return undefined;
  return provider
    .getAccountAddresses()
    .find((value) => /^\d+\.\d+\.\d+$/.test(value));
}

function createWalletConnection(
  runtime: WalletRuntime,
  accountId: string,
): WalletConnection {
  return {
    accountId,
    async disconnect() {
      await runtime.provider.disconnect();
    },
    async signAndExecute(review) {
      assertWalletCanSign(review, accountId);
      await initializeRestoredHederaProvider(
        runtime.provider,
        runtime.optionalNamespaces,
      );
      const [{ AccountId, Hbar, TransferTransaction }, sharedUtils] =
        await Promise.all([
          import("@hiero-ledger/sdk"),
          import("@hashgraph/hedera-wallet-connect/dist/lib/shared/utils"),
        ]);
      const { transactionToBase64String } = sharedUtils;
      const amount = Hbar.fromTinybars(review.amountTinybars);
      const transaction = new TransferTransaction()
        .addHbarTransfer(AccountId.fromString(review.payer), amount.negated())
        .addHbarTransfer(AccountId.fromString(review.treasury), amount)
        .setTransactionMemo(review.memo);
      const result = await runtime.provider.hedera_signAndExecuteTransaction({
        signerAccountId: `hedera:${review.network}:${review.payer}`,
        transactionList: transactionToBase64String(transaction),
      });
      return parseWalletTransactionId(result);
    },
  };
}

export async function restoreHederaWallet(
  projectId: string,
): Promise<WalletConnection | undefined> {
  const runtime = await getRuntime(projectId);
  const accountId = connectedAccount(runtime.provider);
  return accountId ? createWalletConnection(runtime, accountId) : undefined;
}

export async function connectHederaWallet(
  projectId: string,
): Promise<WalletConnection> {
  const runtime = await getRuntime(projectId);
  const accountId = await new Promise<string>((resolve, reject) => {
    const existing = connectedAccount(runtime.provider);
    if (existing) {
      resolve(existing);
      return;
    }

    const timeout = window.setTimeout(
      () => reject(new Error("Wallet connection timed out")),
      120_000,
    );
    runtime.provider.once("connect", () => {
      window.clearTimeout(timeout);
      const account = connectedAccount(runtime.provider);
      if (account) resolve(account);
      else reject(new Error("Wallet did not expose a Hedera account"));
    });
    void runtime.appKit.open();
  });

  return createWalletConnection(runtime, accountId);
}
