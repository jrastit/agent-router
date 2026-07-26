import { describe, expect, it } from "vitest";

import { selectZgProvider } from "./supabase-execution";

const providers = [
  { address: "0xverified", trustMode: "verified" },
  { address: "0xprivate", trustMode: "private" },
  { address: "0xunknown", trustMode: "unknown" },
];

describe("0G provider selection", () => {
  it("uses a verified route for a public instance when needed", () => {
    expect(
      selectZgProvider("public", [
        { address: "0xverified", trustMode: "verified" },
      ]),
    ).toEqual({ address: "0xverified", trustMode: "verified" });
  });

  it("prefers a private route when one is available", () => {
    expect(selectZgProvider("public", providers)).toEqual({
      address: "0xprivate",
      trustMode: "private",
    });
  });

  it("fails closed when a confidential instance has no private route", () => {
    expect(
      selectZgProvider("confidential", [
        { address: "0xverified", trustMode: "verified" },
      ]),
    ).toBeUndefined();
  });
});
