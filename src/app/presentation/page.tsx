import type { Metadata } from "next";

import PresentationDeck from "./presentation-deck";

export const metadata: Metadata = {
  title: "AgentRouter — Hackathon presentation",
  description:
    "A 4–5 minute presentation of AgentRouter's routing, payment, and public-proof stack.",
};

export default function PresentationPage() {
  return <PresentationDeck />;
}
