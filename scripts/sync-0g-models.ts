import pg from "pg";

import {
  createZgInstanceRow,
  zgModelCatalogSchema,
  zgProviderCatalogSchema,
} from "../src/lib/llm-instances/0g-sync";
import { parseExactTinybarRate } from "../src/lib/llm-instances/credit-pricing";

const confirmation = "--confirm-production-sync";
if (!process.argv.includes(confirmation)) {
  throw new Error(`Pass ${confirmation} to synchronize the 0G catalog`);
}

const apiKey = process.env.G_API_KEY_PRIVATE;
const baseUrl = (
  process.env.ZG_ROUTER_BASE_URL ?? "https://router-api.0g.ai/v1"
).replace(/\/$/, "");
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.SUPABASE_DB_URL;
const inputPrice = parseExactTinybarRate(
  "ZG_INPUT_PRICE_TINYBAR_PER_MILLION",
  process.env.ZG_INPUT_PRICE_TINYBAR_PER_MILLION,
);
const outputPrice = parseExactTinybarRate(
  "ZG_OUTPUT_PRICE_TINYBAR_PER_MILLION",
  process.env.ZG_OUTPUT_PRICE_TINYBAR_PER_MILLION,
);
if (!apiKey || (!databaseUrl && (!supabaseUrl || !serviceRoleKey))) {
  throw new Error("0G or Supabase server configuration is missing");
}
const config = {
  apiKey,
  baseUrl,
  supabaseUrl,
  serviceRoleKey,
  databaseUrl,
};

const providerHeaders = {
  authorization: `Bearer ${config.apiKey}`,
  accept: "application/json",
};

async function main() {
  const modelResponse = await fetch(`${config.baseUrl}/models`, {
    headers: providerHeaders,
    signal: AbortSignal.timeout(15_000),
  });
  if (!modelResponse.ok) {
    throw new Error(`0G models request failed (${modelResponse.status})`);
  }
  const models = zgModelCatalogSchema.parse(await modelResponse.json()).data;
  const syncedAt = new Date().toISOString();
  const rows = await Promise.all(
    models.map(async (model) => {
      const providerResponse = await fetch(
        `${config.baseUrl}/providers?model=${encodeURIComponent(model.id)}`,
        {
          headers: providerHeaders,
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!providerResponse.ok) {
        throw new Error(
          `0G providers request failed for ${model.id} (${providerResponse.status})`,
        );
      }
      const providers = zgProviderCatalogSchema.parse(
        await providerResponse.json(),
      ).data;
      return {
        ...createZgInstanceRow({
          model,
          providers,
          baseUrl: config.baseUrl,
          syncedAt,
        }),
        input_price_tinybar_per_million: inputPrice,
        output_price_tinybar_per_million: outputPrice,
        price_synced_at: syncedAt,
      };
    }),
  );

  if (config.databaseUrl) {
    await upsertThroughDatabase(config.databaseUrl, rows);
  } else {
    const upsertResponse = await fetch(
      `${config.supabaseUrl!.replace(/\/$/, "")}/rest/v1/llm_instances?on_conflict=provider,model_id`,
      {
        method: "POST",
        headers: {
          apikey: config.serviceRoleKey!,
          authorization: `Bearer ${config.serviceRoleKey!}`,
          "content-type": "application/json",
          prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify(rows),
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!upsertResponse.ok) {
      throw new Error(
        `Supabase model upsert failed (${upsertResponse.status})`,
      );
    }
  }

  process.stdout.write(
    `${JSON.stringify({
      provider: "0g",
      discovered: models.length,
      enabled: rows.filter((row) => row.enabled).length,
      confidential: rows.filter((row) => row.privacy === "confidential").length,
      upserted: rows.length,
      models: rows.map((row) => ({
        id: row.model_id,
        capabilities: row.capabilities,
        privacy: row.privacy,
        enabled: row.enabled,
        healthyProviders: row.source_metadata.healthyProviderCount,
      })),
    })}\n`,
  );
}

async function upsertThroughDatabase(
  url: string,
  rows: ReturnType<typeof createZgInstanceRow>[],
) {
  const databaseUrl = new URL(url);
  const client = new pg.Client({
    connectionString: databaseUrl.toString(),
    ...(databaseUrl.hostname === "127.0.0.1" ||
    databaseUrl.hostname === "localhost"
      ? { ssl: false }
      : {}),
  });
  await client.connect();
  try {
    await client.query("begin");
    await client.query(
      `
    with incoming as (
      select *
      from jsonb_to_recordset($1::jsonb) as row(
        provider text,
        model_id text,
        name text,
        base_url text,
        capabilities text[],
        privacy text,
        enabled boolean,
        expected_latency_ms integer,
        input_price_tinybar_per_million bigint,
        output_price_tinybar_per_million bigint,
        price_synced_at timestamptz,
        source_metadata jsonb,
        synced_at timestamptz,
        updated_at timestamptz
      )
    )
    insert into public.llm_instances (
      provider, model_id, name, base_url, capabilities, privacy, enabled,
      expected_latency_ms, input_price_tinybar_per_million,
      output_price_tinybar_per_million, price_synced_at, source_metadata,
      synced_at, updated_at
    )
    select
      provider, model_id, name, base_url, capabilities, privacy, enabled,
      expected_latency_ms, input_price_tinybar_per_million,
      output_price_tinybar_per_million, price_synced_at, source_metadata,
      synced_at, updated_at
    from incoming
    on conflict (provider, model_id) do update set
      name = excluded.name,
      base_url = excluded.base_url,
      capabilities = excluded.capabilities,
      privacy = excluded.privacy,
      enabled = excluded.enabled,
      expected_latency_ms = excluded.expected_latency_ms,
      input_price_tinybar_per_million =
        excluded.input_price_tinybar_per_million,
      output_price_tinybar_per_million =
        excluded.output_price_tinybar_per_million,
      price_synced_at = excluded.price_synced_at,
      source_metadata = excluded.source_metadata,
      synced_at = excluded.synced_at,
      updated_at = excluded.updated_at;
      `,
      [JSON.stringify(rows)],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw new Error("Supabase direct database upsert failed", { cause: error });
  } finally {
    await client.end();
  }
}

void main();
