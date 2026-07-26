"use client";

import { useEffect, useState } from "react";

import {
  authenticateWithSupabase,
  clearSupabaseSession,
  restoreSupabaseSession,
  saveSupabaseSession,
  type SupabaseAuthMode,
} from "../lib/auth/supabase";
import { formatTinybarsAsHbar } from "../lib/deposit/balance";
import type { UserSigningRequest } from "../lib/deposit/workflow";
import {
  createDepositWalletReview,
  type DepositWalletReview,
} from "../lib/deposit/wallet";
import type { connectHederaWallet } from "../lib/deposit/wallet-client";

type WalletConnection = Awaited<ReturnType<typeof connectHederaWallet>>;
type IntentResponse = {
  intent: { id: string };
  signingRequest: UserSigningRequest;
};
type BalanceResponse = { balanceTinybars: string };

const walletProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

async function loadBalance(accountId: string): Promise<string | undefined> {
  const response = await fetch(
    `/api/hedera/accounts/${encodeURIComponent(accountId)}/balance`,
    { cache: "no-store" },
  );
  if (!response.ok) return undefined;
  const balance = (await response.json()) as BalanceResponse;
  return balance.balanceTinybars;
}

function hbarToTinybars(hbar: string): string | undefined {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{0,8})?$/.test(hbar)) return undefined;
  const [whole, fraction = ""] = hbar.split(".");
  const tinybars = `${whole}${fraction.padEnd(8, "0")}`.replace(/^0+/, "");
  return tinybars || undefined;
}

type DepositWalletPanelProps = {
  onConnectionChange?: (status: {
    accountConnected: boolean;
    accessToken?: string;
    walletAccount?: string;
    balanceHbar?: string;
  }) => void;
};

export default function DepositWalletPanel({
  onConnectionChange,
}: DepositWalletPanelProps) {
  const [accessToken, setAccessToken] = useState("");
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number>();
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authenticatedEmail, setAuthenticatedEmail] = useState("");
  const [amountHbar, setAmountHbar] = useState("0.001");
  const [wallet, setWallet] = useState<WalletConnection>();
  const [balanceTinybars, setBalanceTinybars] = useState<string>();
  const [review, setReview] = useState<DepositWalletReview>();
  const [depositId, setDepositId] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [intentConfirmation, setIntentConfirmation] = useState("");

  useEffect(() => {
    let active = true;

    async function restoreSessions() {
      if (supabaseUrl && supabasePublishableKey) {
        try {
          const session = await restoreSupabaseSession(
            {
              url: supabaseUrl,
              publishableKey: supabasePublishableKey,
            },
            window.localStorage,
          );
          if (active && session) {
            setAccessToken(session.accessToken);
            setSessionExpiresAt(session.expiresAt);
            setAuthenticatedEmail(session.email);
            setAuthEmail(session.email);
            setMessage(`Restored account session for ${session.email}.`);
          }
        } catch {
          clearSupabaseSession(window.localStorage);
        }
      }

      if (walletProjectId) {
        try {
          const { restoreHederaWallet } =
            await import("../lib/deposit/wallet-client");
          const connection = await restoreHederaWallet(walletProjectId);
          if (connection) {
            const balance = await loadBalance(connection.accountId);
            if (active) {
              setWallet(connection);
              setBalanceTinybars(balance);
              setMessage(
                `Restored wallet ${connection.accountId} on Hedera Testnet.`,
              );
            }
          }
        } catch {
          // WalletConnect owns its persisted session and may have none to restore.
        }
      }
    }

    void restoreSessions();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (
      !sessionExpiresAt ||
      !supabaseUrl ||
      !supabasePublishableKey ||
      !accessToken
    ) {
      return;
    }
    let active = true;
    const refreshAt = Math.max(1_000, sessionExpiresAt - Date.now() - 29_000);
    const timer = window.setTimeout(async () => {
      try {
        const session = await restoreSupabaseSession(
          { url: supabaseUrl, publishableKey: supabasePublishableKey },
          window.localStorage,
        );
        if (active && session) {
          setAccessToken(session.accessToken);
          setSessionExpiresAt(session.expiresAt);
          setAuthenticatedEmail(session.email);
        }
      } catch {
        if (active) {
          clearSupabaseSession(window.localStorage);
          setAccessToken("");
          setSessionExpiresAt(undefined);
          setAuthenticatedEmail("");
          setMessage("Your account session expired. Connect again.");
        }
      }
    }, refreshAt);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [accessToken, sessionExpiresAt]);

  useEffect(() => {
    onConnectionChange?.({
      accountConnected: Boolean(authenticatedEmail),
      accessToken: accessToken || undefined,
      walletAccount: wallet?.accountId,
      balanceHbar:
        balanceTinybars === undefined
          ? undefined
          : formatTinybarsAsHbar(balanceTinybars),
    });
  }, [
    accessToken,
    authenticatedEmail,
    balanceTinybars,
    onConnectionChange,
    wallet,
  ]);

  async function authenticate(mode: SupabaseAuthMode) {
    if (!supabaseUrl || !supabasePublishableKey) return;
    setBusy(true);
    setMessage(
      mode === "register"
        ? "Creating your AgentRouter account…"
        : "Connecting your AgentRouter account…",
    );
    try {
      const session = await authenticateWithSupabase(
        { url: supabaseUrl, publishableKey: supabasePublishableKey },
        { email: authEmail, password: authPassword },
        mode,
      );
      setAuthPassword("");
      if (session.accessToken) {
        saveSupabaseSession(window.localStorage, session);
        setAccessToken(session.accessToken);
        setSessionExpiresAt(session.expiresAt);
        setAuthenticatedEmail(session.email);
        setMessage(`Connected as ${session.email}.`);
      } else {
        setMessage(
          `Registration created for ${session.email}. Confirm the email, then connect.`,
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Authentication failed",
      );
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    if (!walletProjectId) return;
    setBusy(true);
    setMessage("Opening an external Hedera wallet…");
    try {
      const { connectHederaWallet } =
        await import("../lib/deposit/wallet-client");
      const connection = await connectHederaWallet(walletProjectId);
      setWallet(connection);
      setBalanceTinybars(undefined);
      setBalanceTinybars(await loadBalance(connection.accountId));
      setMessage(`Connected to ${connection.accountId} on Hedera Testnet.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Wallet failed");
    } finally {
      setBusy(false);
    }
  }

  function disconnectAccount() {
    clearSupabaseSession(window.localStorage);
    setAccessToken("");
    setSessionExpiresAt(undefined);
    setAuthenticatedEmail("");
    setAuthEmail("");
    setAuthPassword("");
    setReview(undefined);
    setDepositId("");
    setIntentConfirmation("");
    setMessage("AgentRouter account disconnected.");
  }

  async function disconnectWallet() {
    if (!wallet) return;
    setBusy(true);
    try {
      await wallet.disconnect();
      setWallet(undefined);
      setBalanceTinybars(undefined);
      setReview(undefined);
      setDepositId("");
      setIntentConfirmation("");
      setMessage("Hedera wallet disconnected.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  }

  async function createIntent() {
    if (!wallet) return;
    const amountTinybars = hbarToTinybars(amountHbar);
    if (!amountTinybars) {
      setMessage("Enter an HBAR amount with no more than 8 decimal places.");
      return;
    }
    setBusy(true);
    setMessage("Binding a deposit intent to the connected payer…");
    setIntentConfirmation("");
    try {
      const response = await fetch("/api/deposits/intents", {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
          "idempotency-key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          payerAccount: wallet.accountId,
          amountTinybars,
        }),
      });
      if (!response.ok) {
        throw new Error(`Deposit intent failed (${response.status})`);
      }
      const payload = (await response.json()) as IntentResponse;
      setDepositId(payload.intent.id);
      setReview(createDepositWalletReview(payload.signingRequest));
      setReviewed(false);
      setTransactionId("");
      setIntentConfirmation(
        `Deposit intent created successfully. Reference: ${payload.intent.id}.`,
      );
      setMessage("Review every bound field before wallet approval.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Intent failed");
    } finally {
      setBusy(false);
    }
  }

  async function approveDeposit() {
    if (!wallet || !review || !reviewed) return;
    setBusy(true);
    setMessage("Waiting for approval in the external wallet…");
    try {
      const id = await wallet.signAndExecute(review);
      const response = await fetch(
        `/api/deposits/${encodeURIComponent(depositId)}/proof`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ transactionId: id }),
        },
      );
      if (!response.ok) {
        throw new Error(`Proof submission failed (${response.status})`);
      }
      setTransactionId(id);
      setMessage(
        "Transaction submitted. Mirror verification remains authoritative and runs separately.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Deposit failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="wallet-deposit"
      id="funds"
      aria-labelledby="wallet-deposit-title"
    >
      <div className="wallet-heading">
        <div>
          <p className="eyebrow">Live user-funded path</p>
          <h3 id="wallet-deposit-title">Add funds</h3>
        </div>
        <span className="network-badge">Hedera Testnet</span>
      </div>
      <p className="wallet-copy">
        Deposit HBAR securely from your wallet. You stay in control and approve
        the transfer in your wallet.
      </p>

      {!walletProjectId && (
        <p className="wallet-warning" role="status">
          Set the browser-safe NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID and rebuild
          to enable wallet connection.
        </p>
      )}

      {(!supabaseUrl || !supabasePublishableKey) && (
        <p className="wallet-warning" role="status">
          Set the browser-safe NEXT_PUBLIC_SUPABASE_URL and
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to enable user accounts. Never
          use the service-role key here.
        </p>
      )}

      <div className="connection-panel">
        <div className="subsection-heading">
          <div>
            <p className="eyebrow">Connections</p>
            <h4>Ready your account</h4>
          </div>
          <span>
            {[authenticatedEmail, wallet].filter(Boolean).length}/2 connected
          </span>
        </div>
        <div className="connection-list">
          <div
            className={`connection-item ${authenticatedEmail ? "complete" : ""}`}
          >
            <div className="step-heading">
              <span className="step-number">
                {authenticatedEmail ? "✓" : "1"}
              </span>
              <div>
                <h4>Your account</h4>
                <p>
                  {authenticatedEmail
                    ? authenticatedEmail
                    : "Sign in to keep your deposit history."}
                </p>
              </div>
              {authenticatedEmail && (
                <button
                  className="text-button"
                  type="button"
                  onClick={disconnectAccount}
                >
                  Sign out
                </button>
              )}
            </div>
            {!authenticatedEmail && (
              <div className="supabase-auth">
                <label>
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    autoComplete="current-password"
                    placeholder="Your password"
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                  />
                </label>
                <div className="auth-actions">
                  <button
                    className="primary-button"
                    type="button"
                    disabled={
                      !supabaseUrl ||
                      !supabasePublishableKey ||
                      !authEmail ||
                      !authPassword ||
                      busy
                    }
                    onClick={() => authenticate("connect")}
                  >
                    Sign in
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    disabled={!authEmail || !authPassword || busy}
                    onClick={() => authenticate("register")}
                  >
                    Create account
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className={`connection-item ${wallet ? "complete" : ""}`}>
            <div className="step-heading">
              <span className="step-number">{wallet ? "✓" : "2"}</span>
              <div>
                <h4>Hedera wallet</h4>
                <p>
                  {wallet
                    ? `${wallet.accountId} · Connected`
                    : "Connect the wallet you want to fund from."}
                </p>
              </div>
              {wallet ? (
                <button
                  className="text-button"
                  type="button"
                  disabled={busy}
                  onClick={disconnectWallet}
                >
                  Disconnect
                </button>
              ) : (
                <button
                  className="secondary-button"
                  type="button"
                  disabled={!walletProjectId || busy}
                  onClick={connect}
                >
                  Connect wallet
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {authenticatedEmail && wallet && (
        <div className="deposit-form">
          <div className="subsection-heading">
            <div>
              <p className="eyebrow">Deposit</p>
              <h4>Choose an amount</h4>
            </div>
            {balanceTinybars !== undefined && (
              <span>
                {formatTinybarsAsHbar(balanceTinybars)} HBAR available
              </span>
            )}
          </div>
          <div className="deposit-step active">
            <div className="step-heading">
              <span className="step-number">3</span>
              <div>
                <h4>Deposit amount</h4>
                <p>Choose how much HBAR to add.</p>
              </div>
            </div>
            <div className="amount-row">
              <label>
                Amount
                <span className="amount-input">
                  <input
                    inputMode="decimal"
                    aria-label="Deposit amount in HBAR"
                    value={amountHbar}
                    onChange={(event) => setAmountHbar(event.target.value)}
                  />
                  <strong>HBAR</strong>
                </span>
                {balanceTinybars !== undefined && (
                  <small>
                    Available: {formatTinybarsAsHbar(balanceTinybars)} HBAR.
                    Keep a little aside for the network fee.
                  </small>
                )}
              </label>
              <button
                className="primary-button"
                type="button"
                disabled={!hbarToTinybars(amountHbar) || busy}
                onClick={createIntent}
              >
                Review deposit
              </button>
            </div>
          </div>
        </div>
      )}

      {intentConfirmation && (
        <div className="wallet-confirmation" role="status" aria-live="polite">
          <strong>Intent confirmed</strong>
          <span>{intentConfirmation}</span>
          <span>
            Review the bound fields below before approving the wallet.
          </span>
        </div>
      )}

      {review && (
        <div className="wallet-review">
          <h4>Review your deposit</h4>
          <dl>
            {Object.entries(review).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <label className="wallet-consent">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(event) => setReviewed(event.target.checked)}
            />
            I reviewed the payer, treasury, network, exact tinybars, memo, and
            expiry.
          </label>
          <button
            type="button"
            disabled={!reviewed || busy}
            onClick={approveDeposit}
          >
            Approve in external wallet
          </button>
        </div>
      )}

      {message && <p className="wallet-message">{message}</p>}
      {transactionId && (
        <a
          className="wallet-proof"
          href={`https://hashscan.io/testnet/transaction/${encodeURIComponent(
            transactionId,
          )}`}
          target="_blank"
          rel="noreferrer"
        >
          Inspect submitted transaction on HashScan ↗
        </a>
      )}
    </section>
  );
}
