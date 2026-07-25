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
    G_API_KEY_PRIVATE: optionalSecret,
    G_API_KEY_MANAGEMENT: optionalSecret,
    ZG_ROUTER_BASE_URL: z.string().url().default("https://router-api.0g.ai/v1"),
    ZG_COMPUTE_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(5).default(3),
    ZG_COMPUTE_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    ZG_STORAGE_EVM_RPC_URL: z
      .string()
      .url()
      .default("https://evmrpc-testnet.0g.ai"),
    ZG_STORAGE_INDEXER_URL: z
      .string()
      .url()
      .default("https://indexer-storage-testnet-turbo.0g.ai"),
    ZG_STORAGE_NETWORK: z.string().min(1).default("0g-galileo-testnet"),
    ZG_STORAGE_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
    ZG_STORAGE_PRIVATE_KEY: optionalSecret,
    ZG_CHAIN_RPC_URL: z.string().url().default("https://evmrpc-testnet.0g.ai"),
    ZG_CHAIN_NETWORK: z.string().min(1).default("0g-galileo-testnet"),
    ZG_CHAIN_CONTRACT_ADDRESS: optionalSecret,
    ZG_CHAIN_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
    ZG_CHAIN_PRIVATE_KEY: optionalSecret,
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
  "G_API_KEY_PRIVATE",
  "G_API_KEY_MANAGEMENT",
  "ZG_ROUTER_BASE_URL",
  "ZG_COMPUTE_MAX_ATTEMPTS",
  "ZG_COMPUTE_TIMEOUT_MS",
  "ZG_STORAGE_EVM_RPC_URL",
  "ZG_STORAGE_INDEXER_URL",
  "ZG_STORAGE_NETWORK",
  "ZG_STORAGE_TIMEOUT_MS",
  "ZG_STORAGE_PRIVATE_KEY",
  "ZG_CHAIN_RPC_URL",
  "ZG_CHAIN_NETWORK",
  "ZG_CHAIN_CONTRACT_ADDRESS",
  "ZG_CHAIN_TIMEOUT_MS",
  "ZG_CHAIN_PRIVATE_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;
