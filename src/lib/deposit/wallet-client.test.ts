import { describe, expect, it, vi } from "vitest";

import {
  ensureHederaProviderReady,
  initializeRestoredHederaProvider,
} from "./wallet-client";

describe("restored Hedera wallet provider", () => {
  it("rebuilds the native provider without starting a new pairing", async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const optionalNamespaces = { hedera: { chains: ["hedera:testnet"] } };

    await initializeRestoredHederaProvider(
      { session: { topic: "persisted-session" }, connect },
      optionalNamespaces,
    );

    expect(connect).toHaveBeenCalledWith({
      optionalNamespaces,
      skipPairing: true,
    });
  });

  it("does not reconnect an initialized or disconnected provider", async () => {
    const initializedConnect = vi.fn();
    await initializeRestoredHederaProvider(
      {
        session: { topic: "persisted-session" },
        nativeProvider: {},
        connect: initializedConnect,
      },
      {},
    );
    expect(initializedConnect).not.toHaveBeenCalled();

    const disconnectedConnect = vi.fn();
    await initializeRestoredHederaProvider(
      { connect: disconnectedConnect },
      {},
    );
    expect(disconnectedConnect).not.toHaveBeenCalled();
  });

  it("opens a fresh external connection for an unusable linked session", async () => {
    let connectListener: (() => void) | undefined;
    const provider = {
      session: { topic: "stale-session" } as unknown,
      nativeProvider: undefined as unknown,
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockImplementation(async () => {
        provider.session = undefined;
      }),
      getAccountAddresses: vi.fn().mockReturnValue(["0.0.1001"]),
      once: vi.fn((_event: "connect", listener: () => void) => {
        connectListener = listener;
      }),
      removeListener: vi.fn(),
    };
    const openConnectView = vi.fn().mockImplementation(async () => {
      provider.session = { topic: "fresh-session" };
      provider.nativeProvider = {};
      connectListener?.();
    });

    await ensureHederaProviderReady({
      provider,
      optionalNamespaces: { hedera: { chains: ["hedera:testnet"] } },
      expectedAccountId: "0.0.1001",
      openConnectView,
      timeoutMs: 1_000,
    });

    expect(provider.disconnect).toHaveBeenCalledOnce();
    expect(openConnectView).toHaveBeenCalledOnce();
    expect(provider.getAccountAddresses).toHaveBeenCalledOnce();
  });
});
