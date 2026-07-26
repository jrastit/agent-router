"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import styles from "./presentation.module.css";

export const presentationSlides = [
  { id: "opening", label: "AgentRouter", seconds: 25 },
  { id: "problem", label: "The missing machine economy", seconds: 30 },
  { id: "router", label: "Route before spending", seconds: 30 },
  { id: "payment", label: "Why blockchain payment", seconds: 35 },
  { id: "hedera", label: "Hedera", seconds: 25 },
  { id: "zero-g", label: "0G", seconds: 25 },
  { id: "graph", label: "The Graph", seconds: 25 },
  { id: "stack", label: "Technical stack", seconds: 30 },
  { id: "close", label: "Live proof", seconds: 45 },
] as const;

export const presentationDurationSeconds = presentationSlides.reduce(
  (total, slide) => total + slide.seconds,
  0,
);

function FlowArrow() {
  return (
    <span className={styles.flowArrow} aria-hidden="true">
      →
    </span>
  );
}

function SlideContent({
  id,
}: {
  id: (typeof presentationSlides)[number]["id"];
}) {
  switch (id) {
    case "opening":
      return (
        <div className={styles.heroSlide}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>ETHGlobal Lisbon 2026</p>
            <h1>
              The economic control plane for <span>autonomous AI.</span>
            </h1>
            <p className={styles.lead}>
              Choose the best eligible service. Pay exactly once. Prove what
              happened.
            </p>
          </div>
          <div className={styles.orbit} aria-label="Route, pay, and prove">
            <Image
              src="/hackathon/agentrouter-logo-512.png"
              alt="AgentRouter"
              width={152}
              height={152}
              priority
            />
            <span className={styles.orbitRoute}>Route</span>
            <span className={styles.orbitPay}>Pay</span>
            <span className={styles.orbitProve}>Prove</span>
          </div>
        </div>
      );
    case "problem":
      return (
        <>
          <p className={styles.eyebrow}>The problem</p>
          <h2>
            Agents can call APIs.
            <br />
            They cannot safely <span>shop.</span>
          </h2>
          <div className={styles.cardGrid}>
            <article>
              <strong>Markets move</strong>
              <p>Models, prices, and availability change faster than code.</p>
            </article>
            <article>
              <strong>Cheap can be wrong</strong>
              <p>
                Privacy, capability, and quality still constrain the choice.
              </p>
            </article>
            <article>
              <strong>Billing is open-ended</strong>
              <p>An API key is not a quote-bound machine payment.</p>
            </article>
            <article>
              <strong>Screenshots prove little</strong>
              <p>
                Other agents need durable, independently checkable evidence.
              </p>
            </article>
          </div>
        </>
      );
    case "router":
      return (
        <>
          <p className={styles.eyebrow}>Why the router matters</p>
          <h2>
            Compare the market <span>before every spend.</span>
          </h2>
          <div className={styles.routerFlow}>
            <div>
              <small>Live catalog</small>
              <strong>Every instance</strong>
              <p>Supabase models + exact decimal prices</p>
            </div>
            <FlowArrow />
            <div>
              <small>Hard policy</small>
              <strong>Only eligible</strong>
              <p>Budget · privacy · capability · score</p>
            </div>
            <FlowArrow />
            <div className={styles.selected}>
              <small>Ranked result</small>
              <strong>Lowest cost first</strong>
              <p>Decision and rejection evidence retained</p>
            </div>
          </div>
          <p className={styles.callout}>
            One objective can move between providers without an application
            rewrite—or an unbounded vendor bill.
          </p>
        </>
      );
    case "payment":
      return (
        <>
          <p className={styles.eyebrow}>Why blockchain payment is needed</p>
          <h2>
            Autonomous software needs
            <br />
            <span>enforceable value boundaries.</span>
          </h2>
          <div className={styles.paymentLayout}>
            <div className={styles.boundary}>
              <span>Accepted quote</span>
              <FlowArrow />
              <span>Exact payment</span>
              <FlowArrow />
              <span>Verified receipt</span>
            </div>
            <ul>
              <li>Exact integer value—not an unlimited billing credential</li>
              <li>Finality verified before execution unlocks</li>
              <li>Idempotent retries cannot become duplicate transfers</li>
              <li>Portable references for users and other agents</li>
            </ul>
          </div>
          <p className={styles.note}>
            Prompts and outputs stay off-chain. Blockchain settles value and
            anchors non-sensitive proof.
          </p>
        </>
      );
    case "hedera":
      return (
        <SponsorSlide
          name="Hedera"
          track="AI & Agentic Payments"
          color="cyan"
          headline="Exact settlement. Mirror-verified. Replay-resistant."
          points={[
            "Quote-bound HBAR payment in integer tinybars",
            "Consensus and Mirror Node verification are separate states",
            "HashScan transaction plus non-sensitive HCS audit anchor",
          ]}
          evidence="Demo: transaction · payer · amount · memo · consensus timestamp"
        />
      );
    case "zero-g":
      return (
        <SponsorSlide
          name="0G"
          track="Infrastructure & Tooling"
          color="violet"
          headline="Decentralized execution with tamper-evident provenance."
          points={[
            "Compute: comparable model routes through the public toolkit",
            "Storage: redacted evidence with a content reference",
            "Chain: canonical receipt hash for independent verification",
          ]}
          evidence="Privacy rule: required private execution fails closed"
        />
      );
    case "graph":
      return (
        <SponsorSlide
          name="The Graph"
          track="Queryable public evidence"
          color="amber"
          headline="Turn verified events into agent-readable data."
          points={[
            "Projects non-sensitive, Mirror-verified Hedera events",
            "Indexes anchor records through a GraphQL Subgraph",
            "Makes consensus-linked evidence discoverable and composable",
          ]}
          evidence="Authority boundary: Hedera verifies payment; The Graph indexes proof"
        />
      );
    case "stack":
      return (
        <>
          <p className={styles.eyebrow}>The whole technical stack</p>
          <h2>
            One control plane. <span>Four trust boundaries.</span>
          </h2>
          <div className={styles.stack}>
            <article>
              <small>Experience</small>
              <strong>Next.js · React · WalletConnect</strong>
              <p>Decision replay, funding, receipts, presentation</p>
            </article>
            <article>
              <small>Control plane</small>
              <strong>TypeScript toolkit · MCP · SSE</strong>
              <p>Policy, exact costing, jobs, durable events</p>
            </article>
            <article>
              <small>Data + AI</small>
              <strong>Supabase · AI SDK · 0G</strong>
              <p>Catalog, ledger, model execution, evidence storage</p>
            </article>
            <article>
              <small>Settlement + proof</small>
              <strong>Hedera · 0G Chain · The Graph</strong>
              <p>HBAR, Mirror, HCS, provenance, indexed discovery</p>
            </article>
          </div>
          <p className={styles.note}>
            Provider keys, chain keys, and database secrets remain server-side.
          </p>
        </>
      );
    case "close":
      return (
        <>
          <p className={styles.eyebrow}>The 45-second live proof</p>
          <h2>
            Discover → compare → select → pay →
            <br />
            verify → deliver → <span>record.</span>
          </h2>
          <div className={styles.demoSteps}>
            <span>1</span>
            <p>Change budget, token estimate, or minimum score.</p>
            <span>2</span>
            <p>Show the cheapest eligible route and a rejected alternative.</p>
            <span>3</span>
            <p>Open public evidence and copy its record reference into MCP.</p>
          </div>
          <blockquote>
            The best eligible service, bounded spend, and a proof any agent can
            verify.
          </blockquote>
        </>
      );
  }
}

function SponsorSlide({
  name,
  track,
  color,
  headline,
  points,
  evidence,
}: {
  name: string;
  track: string;
  color: "cyan" | "violet" | "amber";
  headline: string;
  points: string[];
  evidence: string;
}) {
  return (
    <div className={styles.sponsorSlide} data-color={color}>
      <div className={styles.sponsorName}>
        <p className={styles.eyebrow}>Sponsor integration · {track}</p>
        <h2>{name}</h2>
      </div>
      <div className={styles.sponsorStory}>
        <h3>{headline}</h3>
        <ul>
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <p>{evidence}</p>
      </div>
    </div>
  );
}

export default function PresentationDeck() {
  const [current, setCurrent] = useState(0);
  const slide = presentationSlides[current];

  const move = useCallback((offset: number) => {
    setCurrent((position) =>
      Math.min(presentationSlides.length - 1, Math.max(0, position + offset)),
    );
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (["ArrowRight", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        move(1);
      } else if (["ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault();
        move(-1);
      } else if (event.key === "Home") {
        setCurrent(0);
      } else if (event.key === "End") {
        setCurrent(presentationSlides.length - 1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [move]);

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  }

  return (
    <main className={styles.deck}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          <Image
            src="/hackathon/agentrouter-logo-512.png"
            alt=""
            width={34}
            height={34}
          />
          <span>
            Agent<span>Router</span>
          </span>
        </Link>
        <div className={styles.headerActions}>
          <span>4:30 hackathon deck</span>
          <button type="button" onClick={toggleFullscreen}>
            Fullscreen
          </button>
        </div>
      </header>

      <section
        className={styles.slide}
        aria-live="polite"
        aria-label={`Slide ${current + 1} of ${presentationSlides.length}: ${slide.label}`}
      >
        <SlideContent id={slide.id} />
      </section>

      <footer className={styles.controls}>
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={current === 0}
          aria-label="Previous slide"
        >
          ←
        </button>
        <div className={styles.progress}>
          <div className={styles.progressLabels}>
            <span>
              {String(current + 1).padStart(2, "0")} /{" "}
              {String(presentationSlides.length).padStart(2, "0")}
            </span>
            <strong>{slide.label}</strong>
            <span>{slide.seconds}s</span>
          </div>
          <div className={styles.track}>
            <span
              style={{
                width: `${((current + 1) / presentationSlides.length) * 100}%`,
              }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={current === presentationSlides.length - 1}
          aria-label="Next slide"
        >
          →
        </button>
      </footer>
    </main>
  );
}
