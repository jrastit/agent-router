import { describe, expect, it } from "vitest";

import { parseExactTinybarRate } from "./credit-pricing";

describe("parseExactTinybarRate", () => {
  it("preserves configured exact integer rates as decimal strings", () => {
    expect(parseExactTinybarRate("RATE", "100000000")).toBe("100000000");
    expect(parseExactTinybarRate("RATE", "0")).toBe("0");
    expect(parseExactTinybarRate("RATE", "9007199254740992")).toBe(
      "9007199254740992",
    );
  });

  it.each([undefined, "", "-1", "1.5", "01"])(
    "rejects an unsafe rate: %s",
    (value) => {
      expect(() => parseExactTinybarRate("RATE", value)).toThrow(
        "RATE must be a non-negative bigint integer",
      );
    },
  );

  it("rejects rates that exceed PostgreSQL bigint storage", () => {
    expect(() => parseExactTinybarRate("RATE", "9223372036854775808")).toThrow(
      "RATE must fit a PostgreSQL bigint",
    );
  });
});
