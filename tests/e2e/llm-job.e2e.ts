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
