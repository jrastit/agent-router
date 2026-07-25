import { z } from "zod";

const authResponseSchema = z.object({
  access_token: z.string().min(1).optional(),
  user: z
    .object({ email: z.string().email().nullable().optional() })
    .optional(),
});

export type SupabaseAuthMode = "connect" | "register";

export async function authenticateWithSupabase(
  config: { url: string; publishableKey: string },
  credentials: { email: string; password: string },
  mode: SupabaseAuthMode,
  fetchImpl: typeof fetch = fetch,
): Promise<{ accessToken?: string; email: string }> {
  const endpoint =
    mode === "register"
      ? `${config.url.replace(/\/$/, "")}/auth/v1/signup`
      : `${config.url.replace(/\/$/, "")}/auth/v1/token?grant_type=password`;
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      apikey: config.publishableKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(credentials),
  });
  const payload: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = z
      .object({
        msg: z.string().optional(),
        message: z.string().optional(),
        error_description: z.string().optional(),
      })
      .parse(payload);
    throw new Error(
      message.msg ??
        message.message ??
        message.error_description ??
        `Supabase authentication failed (${response.status})`,
    );
  }

  const parsed = authResponseSchema.parse(payload);
  return {
    accessToken: parsed.access_token,
    email: parsed.user?.email ?? credentials.email,
  };
}
