import { z } from "zod";

const evidenceUrlSchema = z.url().nullable();

export const projectionMonitoringStatusSchema = z
  .strictObject({
    creditState: z.enum([
      "unverified",
      "credited",
      "reconciliation_required",
      "rejected",
    ]),
    hedera: z.strictObject({
      state: z.enum(["awaiting_mirror", "mirror_verified", "rejected"]),
      transactionHash: z.string().min(1).nullable(),
      evidenceUrl: evidenceUrlSchema,
    }),
    evm: z.strictObject({
      state: z.enum([
        "not_ready",
        "submitting",
        "submitted",
        "confirmed",
        "retry_wait",
        "failed_terminal",
      ]),
      chainId: z.literal("1337"),
      transactionHash: z
        .string()
        .regex(/^0x[a-f0-9]{64}$/)
        .nullable(),
      evidenceUrl: evidenceUrlSchema,
    }),
    graph: z.strictObject({
      state: z.enum(["not_ready", "pending", "indexed", "mismatch"]),
      entityId: z
        .string()
        .regex(/^0x[a-f0-9]{64}$/)
        .nullable(),
      evidenceUrl: evidenceUrlSchema,
    }),
    trust: z.literal("allowlisted-relayer-monitoring-only"),
  })
  .superRefine((status, context) => {
    if (
      status.hedera.state !== "mirror_verified" &&
      (status.evm.state !== "not_ready" || status.graph.state !== "not_ready")
    ) {
      context.addIssue({
        code: "custom",
        message: "monitoring cannot advance before Hedera Mirror verification",
      });
    }
    if (
      (status.graph.state === "indexed" || status.graph.state === "mismatch") &&
      status.evm.state !== "confirmed"
    ) {
      context.addIssue({
        code: "custom",
        message: "Graph evidence requires a confirmed destination transaction",
      });
    }
    if (
      status.evm.state === "confirmed" &&
      status.evm.transactionHash === null
    ) {
      context.addIssue({
        code: "custom",
        message: "confirmed destination evidence requires a transaction hash",
      });
    }
    if (status.graph.state === "indexed" && status.graph.entityId === null) {
      context.addIssue({
        code: "custom",
        message: "indexed Graph evidence requires an entity ID",
      });
    }
  });

export type ProjectionMonitoringStatus = z.infer<
  typeof projectionMonitoringStatusSchema
>;

export function evaluateProjectionAuthority(raw: unknown): {
  status: ProjectionMonitoringStatus;
  spendable: boolean;
  authority: "hedera-mirror-and-postgres";
  projectionCanAffectCredit: false;
} {
  const status = projectionMonitoringStatusSchema.parse(raw);
  return {
    status,
    spendable: status.creditState === "credited",
    authority: "hedera-mirror-and-postgres",
    projectionCanAffectCredit: false,
  };
}
