import { describe, expect, it } from "vitest";

import {
  challengeSchema,
  decisionSchema,
  deliverySchema,
  eventSchema,
  fiatMoneySchema,
  hbarAmountSchema,
  jobSchema,
  offerSchema,
  paymentSchema,
  policySchema,
  providerSchema,
  quoteSchema,
  receiptSchema,
  requirementSchema,
} from "./schema";

const now = "2026-07-25T12:00:00.000Z";
const eur = { currency: "EUR", amountMinor: 125 };

describe("commerce domain schemas", () => {
  it("parses every commerce entity", () => {
    const requirement = requirementSchema.parse({
      id: "req_1",
      capability: "summarize",
      privacyClass: "confidential",
      inputType: "text",
      outputType: "text",
    });
    const policy = policySchema.parse({
      id: "pol_1",
      version: 1,
      budget: eur,
      maxTransaction: eur,
      allowedPrivacyClasses: ["confidential"],
      requiredCapabilities: ["summarize"],
    });
    const provider = providerSchema.parse({
      id: "prv_1",
      name: "Private provider",
      capabilities: ["summarize"],
      privacyClasses: ["confidential"],
      settlementAccount: "0.0.1001",
    });
    const offer = offerSchema.parse({
      id: "off_1",
      providerId: provider.id,
      capability: "summarize",
      inputType: "text",
      outputType: "text",
      price: eur,
      expectedLatencyMs: 500,
    });
    const job = jobSchema.parse({
      id: "job_1",
      requirementId: requirement.id,
      policyId: policy.id,
      status: "created",
      createdAt: now,
      updatedAt: now,
    });
    const quote = quoteSchema.parse({
      id: "quo_1",
      jobId: job.id,
      offerId: offer.id,
      price: eur,
      expiresAt: now,
    });
    const decision = decisionSchema.parse({
      id: "dec_1",
      jobId: job.id,
      requirementId: requirement.id,
      policyId: policy.id,
      policyVersion: policy.version,
      selectedProviderId: provider.id,
      selectedOfferId: offer.id,
      considered: [
        {
          providerId: provider.id,
          offerId: offer.id,
          eligible: true,
          reasonCodes: [],
          modelScore: 90,
          rationale: "Strong fit",
          rank: 1,
        },
      ],
      createdAt: now,
    });
    const challenge = challengeSchema.parse({
      version: "1",
      id: "cha_1",
      quoteId: quote.id,
      payerAccount: "0.0.1000",
      recipientAccount: provider.settlementAccount,
      network: "testnet",
      asset: "HBAR",
      amount: "1.25",
      memo: quote.id,
      expiresAt: now,
    });
    const payment = paymentSchema.parse({
      id: "pay_1",
      challengeId: challenge.id,
      transactionId: "0.0.1000@1.000000001",
      status: "submitted",
      amount: "1.25",
      createdAt: now,
    });
    const delivery = deliverySchema.parse({
      id: "del_1",
      jobId: job.id,
      providerId: provider.id,
      status: "completed",
      artifactReference: "artifact_1",
      completedAt: now,
    });
    const receipt = receiptSchema.parse({
      id: "rec_1",
      jobId: job.id,
      decisionId: decision.id,
      paymentId: payment.id,
      deliveryId: delivery.id,
      total: eur,
      createdAt: now,
    });
    const event = eventSchema.parse({
      id: "evt_1",
      jobId: job.id,
      sequence: 0,
      type: "job.created",
      occurredAt: now,
      payload: {},
    });

    expect([
      requirement,
      policy,
      provider,
      offer,
      job,
      quote,
      decision,
      challenge,
      payment,
      delivery,
      receipt,
      event,
    ]).toHaveLength(12);
  });

  it("rejects unknown fields at a domain boundary", () => {
    expect(() =>
      requirementSchema.parse({
        id: "req_1",
        capability: "summarize",
        privacyClass: "public",
        inputType: "text",
        outputType: "text",
        unreviewed: true,
      }),
    ).toThrow();
  });

  it("rejects an invalid completed delivery", () => {
    expect(() =>
      deliverySchema.parse({
        id: "del_invalid",
        jobId: "job_1",
        providerId: "prv_1",
        status: "completed",
        artifactReference: "",
        completedAt: "not-a-timestamp",
      }),
    ).toThrow();
  });

  it("uses exact fiat and HBAR representations", () => {
    expect(
      fiatMoneySchema.parse({ currency: "EUR", amountMinor: 125 }),
    ).toEqual({ currency: "EUR", amountMinor: 125 });
    expect(hbarAmountSchema.parse("1.25000000")).toBe("1.25000000");
    expect(hbarAmountSchema.parse("0")).toBe("0");

    expect(() =>
      fiatMoneySchema.parse({ currency: "EUR", amountMinor: 1.25 }),
    ).toThrow();
    expect(() =>
      fiatMoneySchema.parse({
        currency: "EUR",
        amountMinor: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toThrow();
    expect(() => hbarAmountSchema.parse("0.000000001")).toThrow();
    expect(() => hbarAmountSchema.parse("01.25")).toThrow();
    expect(() => hbarAmountSchema.parse(1.25)).toThrow();
  });
});
