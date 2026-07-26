import { describe, expect, it, vi } from "vitest";

import {
  resumeSubmittedDeposits,
  verifySubmittedDeposit,
} from "./verification-client";

describe("browser deposit verification recovery", () => {
  it("starts authoritative verification immediately after proof submission", async () => {
    const fetcher = vi.fn(async () => Response.json({ state: "credited" }));
    await expect(
      verifySubmittedDeposit("deposit-1", "user-token", fetcher),
    ).resolves.toBe("credited");
    expect(fetcher).toHaveBeenCalledWith(
      "/api/deposits/deposit-1/verify",
      expect.objectContaining({
        method: "POST",
        headers: { authorization: "Bearer user-token" },
      }),
    );
  });

  it("retries Mirror-pending verification without another payment or refresh", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ state: "mirror_pending" }, { status: 202 }),
      )
      .mockResolvedValueOnce(Response.json({ state: "credited" }));
    const delay = vi.fn(async () => undefined);

    await expect(
      verifySubmittedDeposit("deposit-1", "user-token", fetcher, {
        maxAttempts: 2,
        retryDelayMs: 25,
        delay,
      }),
    ).resolves.toBe("credited");

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledWith(25);
  });

  it("resumes owner-visible submitted deposits after session restoration", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json([{ id: "deposit-1" }, { id: "deposit-2" }]),
      )
      .mockResolvedValueOnce(Response.json({ state: "credited" }))
      .mockResolvedValueOnce(
        Response.json({ state: "mirror_pending" }, { status: 202 }),
      );
    await expect(
      resumeSubmittedDeposits(
        { url: "https://project.supabase.co", publishableKey: "publishable" },
        "user-token",
        fetcher,
        { maxAttempts: 1 },
      ),
    ).resolves.toEqual({ credited: 1, pending: 1 });
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      headers: {
        apikey: "publishable",
        authorization: "Bearer user-token",
      },
    });
  });
});
