import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "AgentRouter — Choose, pay, and prove",
  description:
    "Policy-driven AI routing with verifiable execution and settlement evidence.",
  icons: {
    icon: "/hackathon/agentrouter-logo-512.png",
    apple: "/hackathon/agentrouter-logo-512.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
