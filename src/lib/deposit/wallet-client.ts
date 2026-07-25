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

type ReconnectableHederaProvider = RestorableHederaProvider & {
  disconnect(): Promise<void>;
  getAccountAddresses(): string[];
  once(event: "connect", listener: () => void): void;
  removeListener(event: "connect", listener: () => void): void;
};

export async function initializeRestoredHederaProvider(
  provider: RestorableHederaProvider,
  optionalNamespaces: unknown,
): Promise<void> {
  if (provider.session && !provider.nativeProvider) {
    await provider.connect({ optionalNamespaces, skipPairing: true });
  }
}

export async function ensureHederaProviderReady(input: {
  provider: ReconnectableHederaProvider;
  optionalNamespaces: unknown;
  expectedAccountId: string;
  openConnectView(): Promise<unknown>;
  timeoutMs?: number;
}): Promise<void> {
  await initializeRestoredHederaProvider(
    input.provider,
    input.optionalNamespaces,
  );
  if (input.provider.nativeProvider) return;

  if (input.provider.session) await input.provider.disconnect();

  await new Promise<void>((resolve, reject) => {
    const timeout = globalThis.setTimeout(() => {
      input.provider.removeListener("connect", onConnect);
      reject(
        new Error(
          "Reconnect your Hedera wallet to approve this deposit. No payment was submitted.",
        ),
      );
    }, input.timeoutMs ?? 120_000);

    const finish = (error?: unknown) => {
      globalThis.clearTimeout(timeout);
      input.provider.removeListener("connect", onConnect);
      if (error) reject(error);
      else resolve();
    };
    const onConnect = () => {
      void (async () => {
        try {
          await initializeRestoredHederaProvider(
            input.provider,
            input.optionalNamespaces,
          );
          const accountId = input.provider
            .getAccountAddresses()
            .find((value) => /^\d+\.\d+\.\d+$/.test(value));
          if (!input.provider.nativeProvider) {
            throw new Error(
              "The wallet connected without Hedera transaction support. Choose a Hedera-compatible wallet.",
            );
          }
          if (accountId !== input.expectedAccountId) {
            throw new Error(
              "The reconnected wallet does not match the deposit payer.",
            );
          }
          finish();
        } catch (error) {
          finish(error);
        }
      })();
    };

    input.provider.once("connect", onConnect);
    void input.openConnectView().catch(finish);
  });
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
      await ensureHederaProviderReady({
        provider: runtime.provider,
        optionalNamespaces: runtime.optionalNamespaces,
        expectedAccountId: accountId,
        openConnectView: () => runtime.appKit.open({ view: "Connect" }),
      });
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
