import { describe, expect, it, vi } from "vitest";

import {
  authenticateWithSupabase,
  restoreSupabaseSession,
  saveSupabaseSession,
  supabaseSessionStorageKey,
} from "./supabase";

const config = {
  url: "https://project.supabase.co/",
  publishableKey: "browser-safe-publishable-key",
};
const credentials = { email: "user@example.com", password: "secret-pass" };

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("authenticateWithSupabase", () => {
  it("connects an existing user with the password grant", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json({
        access_token: "short-lived-jwt",
        refresh_token: "rotating-refresh-token",
        expires_at: 1_785_000_000,
        user: { email: credentials.email },
      }),
    );

    await expect(
      authenticateWithSupabase(config, credentials, "connect", fetchImpl),
    ).resolves.toEqual({
      accessToken: "short-lived-jwt",
      refreshToken: "rotating-refresh-token",
      expiresAt: 1_785_000_000_000,
      email: credentials.email,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://project.supabase.co/auth/v1/token?grant_type=password",
      expect.objectContaining({
        headers: expect.objectContaining({ apikey: config.publishableKey }),
      }),
    );
  });

  it("supports registration that requires email confirmation", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(Response.json({ user: { email: credentials.email } }));

    await expect(
      authenticateWithSupabase(config, credentials, "register", fetchImpl),
    ).resolves.toEqual({
      accessToken: undefined,
      refreshToken: undefined,
      expiresAt: undefined,
      email: credentials.email,
    });
  });

  it("surfaces a Supabase auth error", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        Response.json({ msg: "Invalid login" }, { status: 400 }),
      );

    await expect(
      authenticateWithSupabase(config, credentials, "connect", fetchImpl),
    ).rejects.toThrow("Invalid login");
  });

  it("restores a valid browser session without a network request", async () => {
    const storage = memoryStorage();
    const session = {
      accessToken: "valid-access-token",
      refreshToken: "valid-refresh-token",
      expiresAt: 1_785_000_120_000,
      email: credentials.email,
    };
    expect(saveSupabaseSession(storage, session)).toBe(true);
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(
      restoreSupabaseSession(
        config,
        storage,
        fetchImpl,
        () => 1_785_000_000_000,
      ),
    ).resolves.toEqual(session);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rotates an expired browser session with the refresh token", async () => {
    const storage = memoryStorage();
    saveSupabaseSession(storage, {
      accessToken: "expired-access-token",
      refreshToken: "old-refresh-token",
      expiresAt: 1_784_999_999_000,
      email: credentials.email,
    });
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        expires_in: 3_600,
        user: { email: credentials.email },
      }),
    );

    await expect(
      restoreSupabaseSession(
        config,
        storage,
        fetchImpl,
        () => 1_785_000_000_000,
      ),
    ).resolves.toEqual({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
      expiresAt: 1_785_003_600_000,
      email: credentials.email,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://project.supabase.co/auth/v1/token?grant_type=refresh_token",
      expect.objectContaining({
        body: JSON.stringify({ refresh_token: "old-refresh-token" }),
      }),
    );
    expect(storage.getItem(supabaseSessionStorageKey)).toContain(
      "new-access-token",
    );
  });

  it("clears a malformed persisted session", async () => {
    const storage = memoryStorage();
    storage.setItem(supabaseSessionStorageKey, "not-json");

    await expect(
      restoreSupabaseSession(config, storage),
    ).resolves.toBeUndefined();
    expect(storage.getItem(supabaseSessionStorageKey)).toBeNull();
  });
});
