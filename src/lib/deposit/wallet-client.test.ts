import { describe, expect, it, vi } from "vitest";

import { initializeRestoredHederaProvider } from "./wallet-client";

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
});
