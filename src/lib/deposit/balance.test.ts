import { describe, expect, it, vi } from "vitest";

import { fetchHederaBalance, formatTinybarsAsHbar } from "./balance";

describe("fetchHederaBalance", () => {
  it("preserves an exact tinybar balance from the mirror node", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response('{"balance":{"balance":50000000000000001}}'),
      );

    await expect(
      fetchHederaBalance("https://mirror.example/", "0.0.123", fetchImpl),
    ).resolves.toEqual({
      accountId: "0.0.123",
      balanceTinybars: "50000000000000001",
    });
  });

  it("rejects invalid accounts before making a request", async () => {
    const fetchImpl = vi.fn();
    await expect(
      fetchHederaBalance("https://mirror.example", "invalid", fetchImpl),
    ).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("formatTinybarsAsHbar", () => {
  it.each([
    ["0", "0"],
    ["1", "0.00000001"],
    ["100000000", "1"],
    ["123450000", "1.2345"],
  ])("formats %s tinybars as %s HBAR", (tinybars, hbar) => {
    expect(formatTinybarsAsHbar(tinybars)).toBe(hbar);
  });
});
