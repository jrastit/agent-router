import {
  createFixtureAdapter,
  createLiveAdapter,
  demoProviders,
  runLlmJobDemo,
  type DemoProvider,
} from "../examples/llm-job-demo";

function option(name: string) {
  const prefix = `--${name}=`;
  return process.argv
    .find((value) => value.startsWith(prefix))
    ?.slice(prefix.length);
}

const provider = (option("provider") ?? "scaleway") as DemoProvider;
if (!demoProviders.includes(provider)) {
  throw new Error("--provider must be scaleway or 0g");
}
const mode = option("mode") ?? "offline";
if (mode !== "offline" && mode !== "live") {
  throw new Error("--mode must be offline or live");
}

if (mode === "live") {
  console.error(
    "LIVE DEMO: this command consumes real provider tokens. The summary remains redacted.",
  );
}

async function main() {
  const result = await runLlmJobDemo(
    mode === "offline"
      ? createFixtureAdapter(provider)
      : createLiveAdapter(provider),
    {
      provider,
      prompt:
        process.env.LLM_DEMO_PROMPT ??
        "Return a one-sentence private capability summary.",
      maximumInputTokens: 256,
      maximumOutputTokens: 128,
      spendCeilingMicrousd: "1000000",
      idempotencyKey: process.env.LLM_DEMO_IDEMPOTENCY_KEY ?? "local-demo-001",
    },
  );

  // The result contract deliberately excludes the prompt, output, and credentials.
  console.log(JSON.stringify(result, null, 2));
}

void main();
