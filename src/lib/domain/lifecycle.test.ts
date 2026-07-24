import { describe, expect, it } from "vitest";

import {
  deliveryStateSchema,
  eventTypeSchema,
  failureReasonCodeSchema,
  jobStateSchema,
  paymentStateSchema,
} from "./lifecycle";

describe("domain lifecycle vocabularies", () => {
  it("distinguishes consensus confirmation from mirror verification", () => {
    expect(paymentStateSchema.parse("consensus_confirmed")).toBe(
      "consensus_confirmed",
    );
    expect(paymentStateSchema.parse("mirror_verified")).toBe("mirror_verified");
    expect(jobStateSchema.parse("payment_confirmed_mirror_pending")).toBe(
      "payment_confirmed_mirror_pending",
    );
  });

  it("accepts stable delivery, event, and failure values", () => {
    expect(deliveryStateSchema.parse("completed")).toBe("completed");
    expect(eventTypeSchema.parse("receipt.recorded")).toBe("receipt.recorded");
    expect(failureReasonCodeSchema.parse("PAYMENT_AMBIGUOUS")).toBe(
      "PAYMENT_AMBIGUOUS",
    );
  });

  it("rejects unrecognized lifecycle values", () => {
    expect(() => jobStateSchema.parse("done")).toThrow();
    expect(() => paymentStateSchema.parse("confirmed")).toThrow();
    expect(() => failureReasonCodeSchema.parse("UNKNOWN")).toThrow();
  });
});
