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
    OPENAI_API_KEY: optionalSecret,
    SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
  })
  .strict();

export const serverOnlyEnvKeys = [
  "APP_ENV",
  "HEDERA_NETWORK",
  "HEDERA_OPERATOR_ID",
  "HEDERA_OPERATOR_KEY",
  "OPENAI_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;
