"use client";

import Image from "next/image";
import { useCallback, useMemo, useState } from "react";

import DepositWalletPanel from "./deposit-wallet-panel";
import EconomicActivityPanel from "./economic-activity-panel";
import EvidenceTabs from "./evidence-tabs";

const providers = [
  {
    name: "Scaleway Generative APIs",
    priceMinor: 3,
    latency: "1.8s",
    privacy: "public",
    account: "0.0.6101001",
  },
  {
    name: "Private Compute Provider",
    priceMinor: 7,
    latency: "2.6s",
    privacy: "confidential",
    account: "0.0.6101002",
  },
] as const;

const transactionUrl =
  "https://hashscan.io/testnet/transaction/0.0.9651299@1784940981.712442947";
const topicUrl = "https://hashscan.io/testnet/topic/0.0.9676520";
function cents(amount: number) {
  return `$${(amount / 100).toFixed(2)}`;
}

export default function Home() {
  const [budgetMinor, setBudgetMinor] = useState(10);
  const [privacy, setPrivacy] = useState<"public" | "confidential">("public");
  const [fundingStatus, setFundingStatus] = useState<{
    accountConnected: boolean;
    walletAccount?: string;
    balanceHbar?: string;
  }>({ accountConnected: false });
  const updateFundingStatus = useCallback(
    (status: typeof fundingStatus) => setFundingStatus(status),
    [],
  );

  const evaluated = useMemo(
    () =>
      providers.map((provider) => {
        const reasons: string[] = [];
        if (privacy === "confidential" && provider.privacy !== "confidential") {
          reasons.push("Private compute required");
        }
        if (provider.priceMinor > budgetMinor) {
          reasons.push("Over budget");
        }
        return { ...provider, reasons, eligible: reasons.length === 0 };
      }),
    [budgetMinor, privacy],
  );
  const selected = evaluated.find((provider) => provider.eligible);

  return (
    <main>
      <header className="shell hero">
        <nav>
          <a className="brand" href="#">
            <Image
              className="brand-mark"
              src="/hackathon/agentrouter-logo-512.png"
              alt=""
              width={42}
              height={42}
              priority
            />
            <span>
              Agent<span>Router</span>
            </span>
          </a>
          <div className="nav-funding">
            {fundingStatus.walletAccount && (
              <span className="nav-balance">
                <strong>{fundingStatus.balanceHbar ?? "—"} HBAR</strong>
                <small>{fundingStatus.walletAccount}</small>
              </span>
            )}
            <a className="nav-connect" href="#funds">
              {fundingStatus.walletAccount
                ? "Manage wallet"
                : fundingStatus.accountConnected
                  ? "Connect wallet"
                  : "Connect"}
            </a>
          </div>
        </nav>

        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">Economic decision infrastructure</p>
            <h1>Watch an agent choose, pay, and prove.</h1>
            <p className="lede">
              A compact, inspectable commerce run: alternatives compared, policy
              enforced, and settlement verified on Hedera.
            </p>
          </div>
          <div className="hero-proof">
            <div className="route-graphic" aria-hidden="true">
              <i />
              <i />
              <i />
              <b />
              <span>✓</span>
            </div>
            <div className="proof-card">
              <span>Verified public evidence</span>
              <strong>0.001 HBAR</strong>
              <p>SUCCESS · CRYPTOTRANSFER</p>
              <a href={transactionUrl} target="_blank" rel="noreferrer">
                View transaction on HashScan ↗
              </a>
            </div>
          </div>
        </div>
      </header>

      <section className="shell demo" aria-labelledby="demo-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Interactive decision replay</p>
            <h2 id="demo-title">Route a summarization task</h2>
          </div>
          <p className="fixture-note">
            Deterministic providers · no new payment is submitted
          </p>
        </div>

        <div className="workspace">
          <form
            className="controls"
            onSubmit={(event) => event.preventDefault()}
          >
            <label>
              Task
              <textarea
                defaultValue="Summarize the hackathon briefing for the team."
                aria-label="Task"
              />
            </label>
            <label>
              Maximum budget
              <div className="range-row">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={budgetMinor}
                  onChange={(event) =>
                    setBudgetMinor(Number(event.target.value))
                  }
                  aria-label="Maximum budget"
                />
                <output>{cents(budgetMinor)}</output>
              </div>
            </label>
            <fieldset>
              <legend>Privacy policy</legend>
              <div className="segmented">
                {(["public", "confidential"] as const).map((value) => (
                  <button
                    className={privacy === value ? "active" : ""}
                    key={value}
                    type="button"
                    onClick={() => setPrivacy(value)}
                  >
                    {value === "public" ? "Public OK" : "Confidential"}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="policy">
              <span>Policy v1</span>
              <span>Exact USD cents</span>
              <span>Summarize capability</span>
            </div>
          </form>

          <div className="results">
            <div className="result-topline">
              <h3>Normalized quotes</h3>
              <span>
                {evaluated.filter((item) => item.eligible).length} eligible
              </span>
            </div>
            <div className="provider-list">
              {evaluated.map((provider) => {
                const isSelected = selected?.name === provider.name;
                return (
                  <article
                    className={`provider ${isSelected ? "selected" : ""} ${
                      !provider.eligible ? "excluded" : ""
                    }`}
                    key={provider.name}
                  >
                    <div className="provider-main">
                      <span className="provider-icon">
                        {provider.privacy === "confidential" ? "◇" : "◌"}
                      </span>
                      <div>
                        <h4>{provider.name}</h4>
                        <p>
                          {provider.latency} expected · {provider.privacy} ·{" "}
                          {provider.account}
                        </p>
                      </div>
                    </div>
                    <div className="quote">
                      <strong>{cents(provider.priceMinor)}</strong>
                      {isSelected && <span>Selected</span>}
                      {!provider.eligible && (
                        <span className="reason">
                          {provider.reasons.join(" · ")}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            <div className={`decision ${selected ? "" : "no-match"}`}>
              <span>Decision</span>
              <strong>
                {selected
                  ? `${selected.name} wins at ${cents(selected.priceMinor)}`
                  : "No provider satisfies this policy"}
              </strong>
              <p>
                {selected
                  ? "Hard constraints pass; lowest eligible exact quote wins."
                  : "Increase the budget or relax the privacy requirement."}
              </p>
            </div>
          </div>
        </div>
        <EconomicActivityPanel />
        <DepositWalletPanel onConnectionChange={updateFundingStatus} />
      </section>

      <section className="evidence">
        <div className="shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Verified run · 25 July 2026</p>
              <h2>From decision to public proof</h2>
            </div>
            <a href={topicUrl} target="_blank" rel="noreferrer">
              Inspect HCS topic on HashScan ↗
            </a>
          </div>
          <EvidenceTabs />
        </div>
      </section>
    </main>
  );
}
