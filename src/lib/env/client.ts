import { publicEnvSchema } from "./schema";

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
});
