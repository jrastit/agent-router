import { z } from "zod";

const optionalSecret = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

export const publicEnvSchema = z
  .object({
    NEXT_PUBLIC_APP_NAME: z.string().min(1).default("AgentRouter"),
  })
  .strict();

export const serverEnvSchema = z
  .object({
    APP_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    HEDERA_NETWORK: z.enum(["testnet"]).default("testnet"),
    HEDERA_OPERATOR_ID: optionalSecret,
    HEDERA_OPERATOR_KEY: optionalSecret,
    HEDERA_RECIPIENT_ID: optionalSecret,
    HEDERA_TRANSFER_HBAR: optionalSecret,
    HEDERA_TOPIC_ID: optionalSecret,
    HEDERA_MIRROR_NODE_URL: z
      .string()
      .url()
      .default("https://testnet.mirrornode.hedera.com"),
    DISCOVERY_SOURCE: z.enum(["fixture", "the-graph"]).default("fixture"),
    GRAPH_ENDPOINT: z.string().url().optional(),
    GRAPH_DEPLOYMENT_ID: z.string().min(1).optional(),
    GRAPH_NETWORK: z.string().min(1).optional(),
    GRAPH_MAX_STALENESS_MS: z.coerce
      .number()
      .int()
      .nonnegative()
      .default(300_000),
    GRAPH_ACCESS_TOKEN: optionalSecret,
    SCALEWAY_GENAI_API_KEY: optionalSecret,
    SCALEWAY_GENAI_BASE_URL: z
      .string()
      .url()
      .default("https://api.scaleway.ai/v1"),
    SCALEWAY_GENAI_MODEL: z.string().min(1).default("qwen3.5-27b"),
    PLANNER_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
    SUPABASE_URL: z.string().url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
  })
  .strict();

export const serverOnlyEnvKeys = [
  "APP_ENV",
  "HEDERA_NETWORK",
  "HEDERA_OPERATOR_ID",
  "HEDERA_OPERATOR_KEY",
  "HEDERA_RECIPIENT_ID",
  "HEDERA_TRANSFER_HBAR",
  "HEDERA_TOPIC_ID",
  "HEDERA_MIRROR_NODE_URL",
  "DISCOVERY_SOURCE",
  "GRAPH_ENDPOINT",
  "GRAPH_DEPLOYMENT_ID",
  "GRAPH_NETWORK",
  "GRAPH_MAX_STALENESS_MS",
  "GRAPH_ACCESS_TOKEN",
  "SCALEWAY_GENAI_API_KEY",
  "SCALEWAY_GENAI_BASE_URL",
  "SCALEWAY_GENAI_MODEL",
  "PLANNER_TIMEOUT_MS",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;
