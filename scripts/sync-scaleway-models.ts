import { z } from "zod";

import { parseExactTinybarRate } from "../src/lib/llm-instances/credit-pricing";

const confirmation = "--confirm-production-sync";
if (!process.argv.includes(confirmation)) {
  throw new Error(`Pass ${confirmation} to synchronize the Scaleway catalog`);
}

const scalewayKey =
  process.env.SCALEWAY_GENAI_API_KEY ?? process.env.OPENAI_API_KEY;
const scalewayBase =
  process.env.SCALEWAY_GENAI_BASE_URL ??
  process.env.SCALEWAY_GENAI_API_BASE ??
  "https://api.scaleway.ai/v1";
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const inputPrice = parseExactTinybarRate(
  "SCALEWAY_INPUT_PRICE_TINYBAR_PER_MILLION",
  process.env.SCALEWAY_INPUT_PRICE_TINYBAR_PER_MILLION,
);
const outputPrice = parseExactTinybarRate(
  "SCALEWAY_OUTPUT_PRICE_TINYBAR_PER_MILLION",
  process.env.SCALEWAY_OUTPUT_PRICE_TINYBAR_PER_MILLION,
);
if (!scalewayKey || !supabaseUrl || !serviceRoleKey) {
  throw new Error("Scaleway or Supabase server configuration is missing");
}
const config = { scalewayKey, scalewayBase, supabaseUrl, serviceRoleKey };

const modelSchema = z.object({
  id: z.string().min(1).max(300),
  created: z.number().optional(),
  owned_by: z.string().optional(),
});
const catalogSchema = z.object({ data: z.array(modelSchema).max(200) });

function capabilities(modelId: string): string[] {
  const id = modelId.toLowerCase();
  if (id.includes("embed") || id.includes("bge") || id.includes("e5-")) {
    return ["embedding"];
  }
  if (id.includes("rerank")) return ["rerank"];
  if (id.includes("whisper")) return ["transcription"];
  return ["chat"];
}

async function main() {
  const modelResponse = await fetch(
    `${config.scalewayBase.replace(/\/$/, "")}/models`,
    {
      headers: {
        authorization: `Bearer ${config.scalewayKey}`,
        accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!modelResponse.ok) {
    throw new Error(`Scaleway models request failed (${modelResponse.status})`);
  }
  const models = catalogSchema.parse(await modelResponse.json()).data;
  const syncedAt = new Date().toISOString();
  const rows = models.map((model) => ({
    provider: "scaleway",
    model_id: model.id,
    name: model.id,
    base_url: config.scalewayBase,
    capabilities: capabilities(model.id),
    privacy: "public",
    enabled: true,
    expected_latency_ms: 1800,
    input_price_tinybar_per_million: inputPrice,
    output_price_tinybar_per_million: outputPrice,
    price_synced_at: syncedAt,
    source_metadata: {
      object: "model",
      ...(model.created !== undefined ? { created: model.created } : {}),
      ...(model.owned_by ? { ownedBy: model.owned_by } : {}),
    },
    synced_at: syncedAt,
    updated_at: syncedAt,
  }));

  const upsertResponse = await fetch(
    `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/llm_instances?on_conflict=provider,model_id`,
    {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.serviceRoleKey}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!upsertResponse.ok) {
    throw new Error(`Supabase model upsert failed (${upsertResponse.status})`);
  }

  process.stdout.write(
    `${JSON.stringify({ provider: "scaleway", discovered: models.length, upserted: rows.length })}\n`,
  );
}

void main();
