import { expect, test } from "@playwright/test";

const jobId = "11111111-1111-4111-8111-111111111111";
const privatePrompt = "E2E private prompt: never expose this publicly.";
const providerSecret = "provider-secret-must-not-reach-browser";

const catalog = [
  {
    id: "scaleway:demo",
    name: "Scaleway demo",
    provider: "scaleway",
    model_id: "qwen-demo",
    capabilities: ["chat"],
    privacy: "public",
    input_price_tinybar_per_million: "100000",
    output_price_tinybar_per_million: "200000",
    price_synced_at: "2026-07-26T03:00:00.000Z",
  },
  {
    id: "0g:demo",
    name: "0G private demo",
    provider: "0g",
    model_id: "llama-private",
    capabilities: ["chat"],
    privacy: "confidential",
    input_price_tinybar_per_million: "120000",
    output_price_tinybar_per_million: "240000",
    price_synced_at: "2026-07-26T03:00:00.000Z",
  },
];

const deliveredSnapshot = {
  id: jobId,
  state: "delivered",
  failureCode: null,
  provider: "0g",
  model: "llama-private",
  capability: "chat",
  privacy: "confidential",
  maximumInputTokens: 512,
  maximumOutputTokens: 128,
  spendCeilingTinybars: "1000000",
  selectedInstance: {
    id: "0g:demo",
    name: "0G private demo",
    provider: "0g",
    model: "llama-private",
    privacy: "confidential",
  },
  usage: {
    promptTokens: 21,
    completionTokens: 34,
    totalTokens: 55,
  },
  accounting: {
    reservedTinybars: "93",
    chargedTinybars: "12",
    refundedTinybars: "81",
    priceSnapshot: {
      inputTinybarsPerMillionTokens: "120000",
      outputTinybarsPerMillionTokens: "240000",
    },
  },
  remainingBalanceTinybars: "999988",
  output: "Durable accounting prevents duplicate execution and charges.",
  evidence: {
    executionId: "0g-execution-e2e-1",
    verificationLabel:
      "0G Router private trust mode; provider-reported, not independently attested",
    providerAddress: "0x1111111111111111111111111111111111111111",
    trustMode: "private",
  },
  createdAt: "2026-07-26T03:00:00.000Z",
  updatedAt: "2026-07-26T03:00:02.000Z",
};

test("runs once, displays exact settlement, and restores after refresh", async ({
  page,
}) => {
  let submissions = 0;
  let executions = 0;
  let snapshots = 0;
  let submittedBody: Record<string, unknown> | undefined;

  await page.route("**/api/llm-job-instances", async (route) => {
    await route.fulfill({ json: catalog });
  });
  await page.route("**/api/llm-jobs", async (route) => {
    submissions += 1;
    expect(route.request().headers().authorization).toBe(
      "Bearer e2e-user-access-token",
    );
    submittedBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      json: { id: jobId, state: "accepted" },
    });
  });
  await page.route(`**/api/llm-jobs/${jobId}/execute`, async (route) => {
    executions += 1;
    expect(route.request().headers().authorization).toBe(
      "Bearer e2e-user-access-token",
    );
    await route.fulfill({ json: { id: jobId, state: "delivered" } });
  });
  await page.route(`**/api/llm-jobs/${jobId}`, async (route) => {
    snapshots += 1;
    await route.fulfill({ json: deliveredSnapshot });
  });

  await page.goto("/e2e/llm-job");
  await expect(
    page.getByRole("heading", { name: "Run a real LLM instance" }),
  ).toBeVisible();
  await page.getByLabel("Instance").selectOption("0g:demo");
  await page.getByLabel("Private prompt").fill(privatePrompt);

  await expect(page.getByText("93 tinybar")).toBeVisible();
  await page.getByRole("button", { name: "Reserve credit and run" }).click();

  await expect(
    page.getByText("Durable accounting prevents duplicate"),
  ).toBeVisible();
  await expect(page.getByText("21 + 34 = 55")).toBeVisible();
  await expect(page.getByText("93 / 12 / 81 tinybar")).toBeVisible();
  await expect(page.getByText("999988 tinybar")).toBeVisible();
  await expect(page.getByText("0g-execution-e2e-1")).toBeVisible();
  await expect(page.getByText(/not independently attested/)).toBeVisible();

  expect(submittedBody).toMatchObject({
    instanceId: "0g:demo",
    prompt: privatePrompt,
    privacy: "confidential",
    maximumInputTokens: 512,
    maximumOutputTokens: 128,
    spendCeilingTinybars: "1000000",
  });
  expect(JSON.stringify(submittedBody)).not.toContain(providerSecret);
  expect(submissions).toBe(1);
  expect(executions).toBe(1);
  expect(snapshots).toBe(1);

  await page.reload();
  await expect(
    page.getByText("Durable accounting prevents duplicate"),
  ).toBeVisible();
  expect(submissions).toBe(1);
  expect(executions).toBe(1);
  expect(snapshots).toBe(2);
  expect(await page.locator("body").textContent()).not.toContain(
    providerSecret,
  );
});

test("runs the Graph evidence MCP demo and shows monitoring provenance", async ({
  page,
}) => {
  const sourceEventId =
    "0xdb3a831451eedd88f68ff90d2d2a6343283b6164282cd600540babb673183a65";
  let requests = 0;

  await page.route("**/api/llm-job-instances", async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.route("**/api/graph-evidence", async (route) => {
    requests += 1;
    expect(route.request().postDataJSON()).toEqual({
      tool: "find_payment",
      input: { reference: sourceEventId },
    });
    expect(JSON.stringify(route.request().postDataJSON())).not.toContain(
      providerSecret,
    );
    await route.fulfill({
      json: {
        protocol: "mcp",
        toolCall: {
          name: "find_payment",
          arguments: { reference: sourceEventId },
        },
        result: {
          tool: "find_payment",
          reference: sourceEventId,
          matches: [
            {
              sourceEventId,
              sourceType: 1,
              sourceId: "0.0.9676520",
              hederaTransactionHash: `0x${"22".repeat(32)}`,
              consensusTimestamp: "1785032494.963654104",
              sourceIndex: "10",
              eventKind: "deposit.credited",
              payloadDigest: `0x${"33".repeat(32)}`,
              schemaVersion: 1,
              relayer: `0x${"44".repeat(20)}`,
              destinationContract: `0x${"55".repeat(20)}`,
              destinationTransactionHash: `0x${"66".repeat(32)}`,
              destinationBlockNumber: "10",
              destinationBlockTimestamp: "1785032496",
              links: {
                hashScanTransaction:
                  "https://hashscan.io/testnet/transaction/0xproof",
                destinationExplorer: null,
              },
            },
          ],
          provenance: {
            endpoint:
              "https://graph.router.fexhu.com/subgraphs/name/agent-router/hedera-projection",
            subgraph: "agent-router/hedera-projection",
            indexedBlock: 10,
            hasIndexingErrors: false,
            completeness: "indexed",
            chainHeadBlock: null,
            lagBlocks: null,
            chain: {
              source: "hedera-testnet",
              destination: "ganache-local",
              destinationChainId: "1337",
            },
            authority:
              "monitoring-only; Hedera Mirror and Postgres remain authoritative",
          },
        },
      },
    });
  });

  await page.goto("/e2e/llm-job");
  await expect(
    page.getByRole("heading", { name: "Inspect public agent transactions" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Run MCP tool" }).click();

  await expect(page.getByText("Structured MCP tool call")).toBeVisible();
  await expect(page.getByText("indexed · block 10")).toBeVisible();
  await expect(page.getByText("deposit.credited")).toBeVisible();
  await expect(page.getByText("Destination block 10")).toBeVisible();
  await expect(page.getByText(/monitoring-only/)).toBeVisible();
  await expect(page.getByText(/Chain-head lag unknown/)).toBeVisible();
  expect(requests).toBe(1);
});
