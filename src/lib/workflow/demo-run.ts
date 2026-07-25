import type { Event } from "@/lib/domain/schema";

export const demoJobId = "verified-demo-2026-07-25";

export const demoWorkflowEvents = [
  {
    id: "event-1",
    jobId: demoJobId,
    sequence: 0,
    type: "job.created",
    occurredAt: "2026-07-25T10:16:18.000Z",
    payload: { detail: "Task, $0.10 budget, and public privacy policy saved" },
  },
  {
    id: "event-2",
    jobId: demoJobId,
    sequence: 1,
    type: "providers.discovered",
    occurredAt: "2026-07-25T10:16:18.410Z",
    payload: { detail: "2 comparable provider offers normalized" },
  },
  {
    id: "event-3",
    jobId: demoJobId,
    sequence: 2,
    type: "quotes.evaluated",
    occurredAt: "2026-07-25T10:16:18.615Z",
    payload: { detail: "Budget and privacy constraints evaluated" },
  },
  {
    id: "event-4",
    jobId: demoJobId,
    sequence: 3,
    type: "provider.selected",
    occurredAt: "2026-07-25T10:16:18.721Z",
    payload: { detail: "Lowest eligible exact quote selected at $0.03" },
  },
  {
    id: "event-5",
    jobId: demoJobId,
    sequence: 4,
    type: "payment.consensus_confirmed",
    occurredAt: "2026-07-25T10:16:21.712Z",
    payload: {
      detail: "Payment confirmed; verifying public record",
      transactionUrl:
        "https://hashscan.io/testnet/transaction/0.0.9651299@1784940981.712442947",
    },
  },
  {
    id: "event-6",
    jobId: demoJobId,
    sequence: 5,
    type: "payment.mirror_verified",
    occurredAt: "2026-07-25T10:16:25.044Z",
    payload: { detail: "Mirror Node matched the bound HBAR transfer" },
  },
  {
    id: "event-7",
    jobId: demoJobId,
    sequence: 6,
    type: "execution.completed",
    occurredAt: "2026-07-25T10:16:27.310Z",
    payload: {
      detail: "Summary delivered by Scaleway Generative APIs",
      delivery:
        "The briefing prioritizes a verifiable routing loop, exact budgets, and independently checkable provenance.",
    },
  },
  {
    id: "event-8",
    jobId: demoJobId,
    sequence: 7,
    type: "receipt.recorded",
    occurredAt: "2026-07-25T10:16:27.488Z",
    payload: { detail: "Receipt persisted and anchored to HCS" },
  },
] satisfies Event[];

export const demoRunSummary = {
  budgetMinor: 10,
  totalSpendMinor: 3,
  remainingBudgetMinor: 7,
  receiptId: "receipt-verified-demo",
  network: "Hedera Testnet",
  amountTinybars: "100,000",
  transactionUrl:
    "https://hashscan.io/testnet/transaction/0.0.9651299@1784940981.712442947",
  topicUrl: "https://hashscan.io/testnet/topic/0.0.9676520",
} as const;
