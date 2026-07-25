"use client";

import { useState } from "react";

import {
  authenticateWithSupabase,
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
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function DepositWalletPanel() {
  const [accessToken, setAccessToken] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authenticatedEmail, setAuthenticatedEmail] = useState("");
  const [amountTinybars, setAmountTinybars] = useState("100000");
  const [wallet, setWallet] = useState<WalletConnection>();
  const [balanceTinybars, setBalanceTinybars] = useState<string>();
  const [review, setReview] = useState<DepositWalletReview>();
  const [depositId, setDepositId] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function authenticate(mode: SupabaseAuthMode) {
    if (!supabaseUrl || !supabaseAnonKey) return;
    setBusy(true);
    setMessage(
      mode === "register"
        ? "Creating your AgentRouter account…"
        : "Connecting your AgentRouter account…",
    );
    try {
      const session = await authenticateWithSupabase(
        { url: supabaseUrl, anonKey: supabaseAnonKey },
        { email: authEmail, password: authPassword },
        mode,
      );
      setAuthPassword("");
      if (session.accessToken) {
        setAccessToken(session.accessToken);
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
      const balanceResponse = await fetch(
        `/api/hedera/accounts/${encodeURIComponent(connection.accountId)}/balance`,
        { cache: "no-store" },
      );
      if (balanceResponse.ok) {
        const balance = (await balanceResponse.json()) as BalanceResponse;
        setBalanceTinybars(balance.balanceTinybars);
      }
      setMessage(`Connected to ${connection.accountId} on Hedera Testnet.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Wallet failed");
    } finally {
      setBusy(false);
    }
  }

  async function createIntent() {
    if (!wallet) return;
    setBusy(true);
    setMessage("Binding a deposit intent to the connected payer…");
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
    <section className="wallet-deposit" aria-labelledby="wallet-deposit-title">
      <div className="wallet-heading">
        <div>
          <p className="eyebrow">Live user-funded path</p>
          <h3 id="wallet-deposit-title">Deposit HBAR with your wallet</h3>
        </div>
        <span>External signature · Testnet</span>
      </div>
      <p className="wallet-copy">
        Your wallet signs and submits the transfer. AgentRouter never receives
        your private key or raw signed transaction.
      </p>

      {!walletProjectId && (
        <p className="wallet-warning" role="status">
          Set the browser-safe NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID and rebuild
          to enable wallet connection.
        </p>
      )}

      {(!supabaseUrl || !supabaseAnonKey) && (
        <p className="wallet-warning" role="status">
          Set the browser-safe NEXT_PUBLIC_SUPABASE_URL and
          NEXT_PUBLIC_SUPABASE_ANON_KEY to enable user accounts. Never use the
          service-role key here.
        </p>
      )}

      <div className="supabase-auth">
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={authEmail}
            onChange={(event) => setAuthEmail(event.target.value)}
            disabled={Boolean(authenticatedEmail)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={authPassword}
            onChange={(event) => setAuthPassword(event.target.value)}
            disabled={Boolean(authenticatedEmail)}
          />
        </label>
        <button
          type="button"
          disabled={
            !supabaseUrl ||
            !supabaseAnonKey ||
            !authEmail ||
            !authPassword ||
            busy ||
            Boolean(authenticatedEmail)
          }
          onClick={() => authenticate("connect")}
        >
          {authenticatedEmail ? `Connected ${authenticatedEmail}` : "Connect"}
        </button>
        <button
          type="button"
          disabled={
            !supabaseUrl ||
            !supabaseAnonKey ||
            !authEmail ||
            !authPassword ||
            busy ||
            Boolean(authenticatedEmail)
          }
          onClick={() => authenticate("register")}
        >
          Register
        </button>
      </div>

      <div className="wallet-controls">
        <label>
          Deposit amount (tinybars)
          <input
            inputMode="numeric"
            pattern="[1-9][0-9]*"
            value={amountTinybars}
            onChange={(event) => setAmountTinybars(event.target.value)}
          />
          <small>
            {wallet && balanceTinybars !== undefined
              ? `Available: ${formatTinybarsAsHbar(balanceTinybars)} HBAR (${balanceTinybars} tinybars). Leave enough for the network fee.`
              : "Connect a wallet to see its testnet HBAR balance."}
          </small>
        </label>
        <button
          type="button"
          disabled={!walletProjectId || busy}
          onClick={connect}
        >
          {wallet ? `Connected ${wallet.accountId}` : "Connect Hedera wallet"}
        </button>
        <button
          type="button"
          disabled={!wallet || !accessToken || busy}
          onClick={createIntent}
        >
          Create bound intent
        </button>
      </div>

      {review && (
        <div className="wallet-review">
          <h4>Exact wallet approval</h4>
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
