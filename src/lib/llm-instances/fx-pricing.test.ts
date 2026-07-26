import { describe, expect, it } from "vitest";

import {
  deriveEurPerMillionTokens,
  parseEcbUsdReferenceRate,
} from "./fx-pricing";

describe("exact 0G EUR pricing", () => {
  it("converts USD per token to EUR per million with half-up rounding", () => {
    expect(
      deriveEurPerMillionTokens({
        usdPerToken: "0.00000008",
        usdPerEur: "1.1377",
      }),
    ).toBe("0.070317");
    expect(
      deriveEurPerMillionTokens({
        usdPerToken: "0.00000048",
        usdPerEur: "1.1377",
      }),
    ).toBe("0.421904");
  });

  it("preserves an upstream EUR token price without using USD", () => {
    expect(
      deriveEurPerMillionTokens({
        eurPerToken: "0.0000012345678",
        usdPerToken: "999",
        usdPerEur: "1.1377",
      }),
    ).toBe("1.234568");
  });

  it("returns undefined without a convertible price and rejects bad rates", () => {
    expect(deriveEurPerMillionTokens({})).toBeUndefined();
    expect(() =>
      deriveEurPerMillionTokens({
        usdPerToken: "0.1",
        usdPerEur: "0",
      }),
    ).toThrow("must be positive");
  });

  it("parses the dated USD rate from the ECB reference XML", () => {
    expect(
      parseEcbUsdReferenceRate(
        `<Cube><Cube time="2026-07-24"><Cube currency="USD" rate="1.1377"/></Cube></Cube>`,
      ),
    ).toEqual({ observedOn: "2026-07-24", usdPerEur: "1.1377" });
  });
});
