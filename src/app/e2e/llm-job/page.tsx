import { notFound } from "next/navigation";

import LlmJobPanel from "../../llm-job-panel";

export const dynamic = "force-dynamic";

export default function LlmJobE2ePage() {
  if (process.env.E2E_TEST_MODE !== "true") notFound();

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: 24 }}>
      <LlmJobPanel accessToken="e2e-user-access-token" />
    </main>
  );
}
