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
    OPENAI_API_KEY: optionalSecret,
    SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
  })
  .strict();

export const serverOnlyEnvKeys = [
  "APP_ENV",
  "HEDERA_NETWORK",
  "HEDERA_OPERATOR_ID",
  "HEDERA_OPERATOR_KEY",
  "DISCOVERY_SOURCE",
  "GRAPH_ENDPOINT",
  "GRAPH_DEPLOYMENT_ID",
  "GRAPH_NETWORK",
  "GRAPH_MAX_STALENESS_MS",
  "GRAPH_ACCESS_TOKEN",
  "OPENAI_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;
