"use client";

import { useMemo, useState } from "react";

import { evaluateProjectionAuthority } from "../lib/projection/status";
import DepositWalletPanel from "./deposit-wallet-panel";
import WorkflowTimeline from "./workflow-timeline";

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
const projectionRunbookUrl =
  "https://github.com/jrastit/agent-router/blob/main/docs/PHASE6B_HEDERA_PROJECTION.md";

const balances = [
  ["Pending", "0 tinybars"],
  ["Credited", "10,000,000 tinybars"],
  ["Reserved", "0 tinybars"],
  ["Spent", "4,000,000 tinybars"],
  ["Refunded", "2,000,000 tinybars"],
  ["Reconciliation", "0 tinybars"],
] as const;

const projectionEvidence = evaluateProjectionAuthority({
  creditState: "credited",
  hedera: {
    state: "mirror_verified",
    transactionHash: "0.0.9651299@1784940981.712442947",
    evidenceUrl: transactionUrl,
  },
  evm: {
    state: "not_ready",
    chainId: "1337",
    transactionHash: null,
    evidenceUrl: projectionRunbookUrl,
  },
  graph: {
    state: "not_ready",
    entityId: null,
    evidenceUrl: projectionRunbookUrl,
  },
  trust: "allowlisted-relayer-monitoring-only",
});

const projectionPlanes = [
  {
    label: "Hedera source",
    state: "Mirror verified",
    detail: "Authoritative payment proof · Hedera Testnet",
    linkLabel: "Open HashScan source ↗",
    evidenceUrl: projectionEvidence.status.hedera.evidenceUrl,
    authority: true,
  },
  {
    label: "EVM projection",
    state: "Awaiting live replay",
    detail: "Monitoring projection · local Ganache chain 1337",
    linkLabel: "Open local deployment evidence ↗",
    evidenceUrl: projectionEvidence.status.evm.evidenceUrl,
    authority: false,
  },
  {
    label: "Graph indexing",
    state: "Not indexed",
    detail: "Monitoring query · independent of spendable credit",
    linkLabel: "Open indexing runbook ↗",
    evidenceUrl: projectionEvidence.status.graph.evidenceUrl,
    authority: false,
  },
] as const;

function cents(amount: number) {
  return `$${(amount / 100).toFixed(2)}`;
}

export default function Home() {
  const [budgetMinor, setBudgetMinor] = useState(10);
  const [privacy, setPrivacy] = useState<"public" | "confidential">("public");

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
            <span className="brand-mark">AR</span>
            AgentRouter
          </a>
          <span className="status">
            <i /> Hedera testnet replay
          </span>
        </nav>

        <div className="hero-grid">
          <div>
            <p className="eyebrow">Economic decision infrastructure</p>
            <h1>Watch an agent choose, pay, and prove.</h1>
            <p className="lede">
              A compact, inspectable commerce run: alternatives compared, policy
              enforced, and settlement verified on Hedera.
            </p>
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
        <section className="credit-evidence" aria-labelledby="credit-title">
          <div>
            <p className="eyebrow">Phase 6A accounting replay</p>
            <h3 id="credit-title">Prepaid application credit</h3>
            <p>
              Illustrative deterministic ledger values. A user-signed HBAR
              deposit is spendable only after Hedera Mirror verification; the
              separately funded 0G treasury pays the provider.
            </p>
          </div>
          <dl className="balance-grid">
            {balances.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="projection-heading">
            <div>
              <p className="eyebrow">Phase 6B monitoring</p>
              <h4>Three independent evidence states</h4>
            </div>
            <span className="trust-label">
              Relayer trust boundary · monitoring only
            </span>
          </div>
          <div className="evidence-planes">
            {projectionPlanes.map((plane) => (
              <article
                className={`evidence-plane ${
                  plane.authority ? "authoritative" : ""
                }`}
                key={plane.label}
              >
                <span>{plane.label}</span>
                <strong>{plane.state}</strong>
                <p>{plane.detail}</p>
                {plane.evidenceUrl && (
                  <a href={plane.evidenceUrl} target="_blank" rel="noreferrer">
                    {plane.linkLabel}
                  </a>
                )}
              </article>
            ))}
          </div>
          <p className="conversion-note">
            Spendable: {projectionEvidence.spendable ? "yes" : "no"} ·
            authority: Hedera Mirror verification + atomic Postgres credit. EVM
            and Graph status cannot create, duplicate, reverse, or delay funds.
            No direct or automatic HBAR-to-0G conversion is claimed.
          </p>
        </section>
        <DepositWalletPanel />
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
          <WorkflowTimeline />
        </div>
      </section>
    </main>
  );
}
