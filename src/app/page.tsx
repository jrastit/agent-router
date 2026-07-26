"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  llmInstanceCatalogSchema,
  type LlmInstanceCatalog,
} from "../lib/llm-instances/schema";
import DepositWalletPanel from "./deposit-wallet-panel";
import EconomicActivityPanel from "./economic-activity-panel";
import EvidenceTabs from "./evidence-tabs";
import GraphEvidencePanel from "./graph-evidence-panel";
import LlmJobPanel from "./llm-job-panel";

const transactionUrl =
  "https://hashscan.io/testnet/transaction/0.0.9651299@1784940981.712442947";
const topicUrl = "https://hashscan.io/testnet/topic/0.0.9676520";
function euroCents(amount: number) {
  return `€${(amount / 100).toFixed(2)}`;
}

export default function Home() {
  const [budgetMinor, setBudgetMinor] = useState(10);
  const [inputTokens, setInputTokens] = useState(1_000_000);
  const [outputTokens, setOutputTokens] = useState(10_000);
  const [privacy, setPrivacy] = useState<"public" | "confidential">("public");
  const [catalog, setCatalog] = useState<LlmInstanceCatalog>();
  const [catalogError, setCatalogError] = useState("");
  const [fundingStatus, setFundingStatus] = useState<{
    accountConnected: boolean;
    accessToken?: string;
    walletAccount?: string;
    balanceHbar?: string;
  }>({ accountConnected: false });
  const updateFundingStatus = useCallback(
    (status: typeof fundingStatus) => setFundingStatus(status),
    [],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/llm-instances", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("catalog unavailable");
        return llmInstanceCatalogSchema.parse(await response.json());
      })
      .then(setCatalog)
      .catch((reason: unknown) => {
        if (!(reason instanceof DOMException && reason.name === "AbortError")) {
          setCatalogError("Live Supabase instance catalog is unavailable.");
        }
      });
    return () => controller.abort();
  }, []);

  const evaluated = useMemo(
    () =>
      evaluateCatalogInstances(
        catalog,
        budgetMinor,
        privacy,
        inputTokens,
        outputTokens,
      ),
    [budgetMinor, catalog, inputTokens, outputTokens, privacy],
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
            Live Supabase catalog · no new payment is submitted
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
                  max="2000"
                  step="1"
                  value={budgetMinor}
                  onChange={(event) =>
                    setBudgetMinor(Number(event.target.value))
                  }
                  aria-label="Maximum budget"
                />
                <output>{euroCents(budgetMinor)}</output>
              </div>
              <small>€0.01–€20.00 estimated job-cost ceiling</small>
            </label>
            <label>
              Estimated input tokens
              <div className="range-row">
                <input
                  type="range"
                  min="0"
                  max="1000000"
                  step="1000"
                  value={inputTokens}
                  onChange={(event) =>
                    setInputTokens(Number(event.target.value))
                  }
                  aria-label="Estimated input tokens"
                />
                <output>{inputTokens.toLocaleString("en-US")}</output>
              </div>
            </label>
            <label>
              Estimated output tokens
              <div className="range-row">
                <input
                  type="range"
                  min="0"
                  max="1000000"
                  step="1000"
                  value={outputTokens}
                  onChange={(event) =>
                    setOutputTokens(Number(event.target.value))
                  }
                  aria-label="Estimated output tokens"
                />
                <output>{outputTokens.toLocaleString("en-US")}</output>
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
              <span>Exact EUR decimal rates</span>
              <span>Chat capability</span>
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
              {!catalog && !catalogError && <p>Loading live instances…</p>}
              {catalogError && <p>{catalogError}</p>}
              {evaluated.map((provider) => {
                const isSelected = selected?.id === provider.id;
                return (
                  <article
                    className={`provider ${isSelected ? "selected" : ""} ${
                      !provider.eligible ? "excluded" : ""
                    }`}
                    key={provider.id}
                  >
                    <div className="provider-main">
                      <span className="provider-icon">
                        {provider.privacy === "confidential" ? "◇" : "◌"}
                      </span>
                      <div>
                        <h4>{provider.name}</h4>
                        <p>
                          {(provider.expectedLatencyMs / 1000).toFixed(1)}s
                          expected · {provider.privacy} · {provider.provider} ·{" "}
                          {provider.model}
                        </p>
                      </div>
                    </div>
                    <div className="quote">
                      <strong>
                        {formatMicroEur(provider.estimatedCostMicroEur)}
                      </strong>
                      <small>
                        input{" "}
                        {formatRate(provider.inputPriceEurPerMillionTokens)} ·
                        output{" "}
                        {formatRate(provider.outputPriceEurPerMillionTokens)} /
                        1M
                      </small>
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
                  ? `${selected.name} wins at an estimated ${formatMicroEur(selected.estimatedCostMicroEur)}`
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
        <EconomicActivityPanel accessToken={fundingStatus.accessToken} />
        <DepositWalletPanel onConnectionChange={updateFundingStatus} />
        <LlmJobPanel accessToken={fundingStatus.accessToken} />
        <GraphEvidencePanel accessToken={fundingStatus.accessToken} />
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

export function evaluateCatalogInstances(
  catalog: LlmInstanceCatalog | undefined,
  budgetMinor: number,
  privacy: "public" | "confidential",
  inputTokens = 1_000_000,
  outputTokens = 10_000,
) {
  return (catalog?.instances ?? [])
    .map((provider) => {
      const reasons: string[] = [];
      const estimatedCostMicroEur = estimateCostMicroEur(
        provider,
        inputTokens,
        outputTokens,
      );
      if (!provider.enabled) reasons.push("Instance disabled");
      if (!provider.capabilities.includes("chat")) {
        reasons.push("Chat capability unavailable");
      }
      if (privacy === "confidential" && provider.privacy !== "confidential") {
        reasons.push("Private compute required");
      }
      if (estimatedCostMicroEur === null) {
        reasons.push("Exact EUR price unavailable");
      } else if (
        estimatedCostMicroEur >
        BigInt(budgetMinor) * BigInt("10000")
      ) {
        reasons.push("Over budget");
      }
      return {
        ...provider,
        estimatedCostMicroEur,
        reasons,
        eligible: reasons.length === 0,
      };
    })
    .sort((left, right) =>
      compareExactRates(
        left.estimatedCostMicroEur,
        right.estimatedCostMicroEur,
      ),
    );
}

function estimateCostMicroEur(
  instance: LlmInstanceCatalog["instances"][number],
  inputTokens: number,
  outputTokens: number,
): bigint | null {
  const input = parseEurMicro(instance.inputPriceEurPerMillionTokens);
  const output = parseEurMicro(instance.outputPriceEurPerMillionTokens);
  if (input === null || output === null) return null;
  const numerator = input * BigInt(inputTokens) + output * BigInt(outputTokens);
  const denominator = BigInt("1000000");
  return (numerator + denominator - BigInt(1)) / denominator;
}

function parseEurMicro(value?: string): bigint | null {
  const match = value?.match(/^(0|[1-9]\d*)(?:\.(\d{1,6}))?$/);
  if (!match) return null;
  return (
    BigInt(match[1]) * BigInt("1000000") +
    BigInt((match[2] ?? "").padEnd(6, "0"))
  );
}

function compareExactRates(left: bigint | null, right: bigint | null) {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left < right ? -1 : 1;
}

function formatMicroEur(value: bigint | null) {
  if (value === null) return "Price unavailable";
  const whole = value / BigInt("1000000");
  const fraction = (value % BigInt("1000000"))
    .toString()
    .padStart(6, "0")
    .replace(/0+$/, "");
  return `€${whole}${fraction ? `.${fraction}` : ""}`;
}

function formatRate(value?: string) {
  return value === undefined ? "—" : `€${value}`;
}
