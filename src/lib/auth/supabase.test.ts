import { describe, expect, it, vi } from "vitest";

import { authenticateWithSupabase } from "./supabase";

const config = {
  url: "https://project.supabase.co/",
  anonKey: "browser-safe-anon-key",
};
const credentials = { email: "user@example.com", password: "secret-pass" };

describe("authenticateWithSupabase", () => {
  it("connects an existing user with the password grant", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json({
        access_token: "short-lived-jwt",
        user: { email: credentials.email },
      }),
    );

    await expect(
      authenticateWithSupabase(config, credentials, "connect", fetchImpl),
    ).resolves.toEqual({
      accessToken: "short-lived-jwt",
      email: credentials.email,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://project.supabase.co/auth/v1/token?grant_type=password",
      expect.objectContaining({
        headers: expect.objectContaining({ apikey: config.anonKey }),
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
});
