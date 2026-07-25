import { z } from "zod";

const authResponseSchema = z.object({
  access_token: z.string().min(1).optional(),
  refresh_token: z.string().min(1).optional(),
  expires_at: z.number().int().positive().optional(),
  expires_in: z.number().int().positive().optional(),
  user: z
    .object({ email: z.string().email().nullable().optional() })
    .optional(),
});

const storedSessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number().int().positive(),
  email: z.string().email(),
});

export type SupabaseBrowserSession = z.infer<typeof storedSessionSchema>;
export type SupabaseAuthMode = "connect" | "register";
export const supabaseSessionStorageKey = "agent-router.supabase-session.v1";

type BrowserStorage = Pick<Storage, "getItem" | "removeItem" | "setItem">;

function sessionFromResponse(
  payload: unknown,
  fallbackEmail: string,
  now: () => number,
): {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  email: string;
} {
  const parsed = authResponseSchema.parse(payload);
  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token,
    expiresAt:
      parsed.expires_at !== undefined
        ? parsed.expires_at * 1_000
        : parsed.expires_in !== undefined
          ? now() + parsed.expires_in * 1_000
          : undefined,
    email: parsed.user?.email ?? fallbackEmail,
  };
}

export function saveSupabaseSession(
  storage: BrowserStorage,
  session: {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    email: string;
  },
): boolean {
  const parsed = storedSessionSchema.safeParse(session);
  if (!parsed.success) return false;
  storage.setItem(supabaseSessionStorageKey, JSON.stringify(parsed.data));
  return true;
}

export function clearSupabaseSession(storage: BrowserStorage): void {
  storage.removeItem(supabaseSessionStorageKey);
}

export async function restoreSupabaseSession(
  config: { url: string; publishableKey: string },
  storage: BrowserStorage,
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<SupabaseBrowserSession | undefined> {
  let rawStored: unknown;
  try {
    rawStored = JSON.parse(
      storage.getItem(supabaseSessionStorageKey) ?? "null",
    );
  } catch {
    clearSupabaseSession(storage);
    return undefined;
  }
  const stored = storedSessionSchema.safeParse(rawStored);
  if (!stored.success) {
    clearSupabaseSession(storage);
    return undefined;
  }
  if (stored.data.expiresAt > now() + 30_000) return stored.data;

  const response = await fetchImpl(
    `${config.url.replace(/\/$/, "")}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        apikey: config.publishableKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ refresh_token: stored.data.refreshToken }),
    },
  );
  if (!response.ok) {
    clearSupabaseSession(storage);
    return undefined;
  }

  const refreshed = sessionFromResponse(
    await response.json(),
    stored.data.email,
    now,
  );
  if (!saveSupabaseSession(storage, refreshed)) {
    clearSupabaseSession(storage);
    return undefined;
  }
  return storedSessionSchema.parse(refreshed);
}

export async function authenticateWithSupabase(
  config: { url: string; publishableKey: string },
  credentials: { email: string; password: string },
  mode: SupabaseAuthMode,
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<{
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  email: string;
}> {
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

  return sessionFromResponse(payload, credentials.email, now);
}
