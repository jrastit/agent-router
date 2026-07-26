import { z } from "zod";

import {
  runnableLlmInstancesSchema,
  type RunnableLlmInstance,
} from "../../lib/llm-jobs/catalog";
import { llmJobSubmissionSchema } from "../../lib/llm-jobs/submission";
import {
  createLlmJobInputSchema,
  createLlmJobOutputSchema,
  listLlmInstancesOutputSchema,
  type CreateLlmJobOutput,
  type ListLlmInstancesOutput,
} from "./contracts";

const submittedJobSchema = z.object({
  id: z.string(),
  state: z.string(),
});

export interface LlmMcpClient {
  listInstances(): Promise<ListLlmInstancesOutput>;
  createJob(
    input: z.infer<typeof createLlmJobInputSchema>,
  ): Promise<CreateLlmJobOutput>;
}

export function createLlmMcpClient(input: {
  catalogHandler: () => Promise<Response>;
  submissionHandler: (request: Request) => Promise<Response>;
  userAccessToken?: string;
}): LlmMcpClient {
  return {
    async listInstances() {
      const response = await input.catalogHandler();
      if (!response.ok) throw new Error("LLM instance catalog unavailable");
      const instances = runnableLlmInstancesSchema.parse(await response.json());
      return listLlmInstancesOutputSchema.parse({
        tool: "list_llm_instances",
        instances: instances.map(publicInstance),
      });
    },

    async createJob(jobInput) {
      if (!input.userAccessToken) {
        throw new Error("Authentication required");
      }
      const { idempotencyKey, ...submission } =
        createLlmJobInputSchema.parse(jobInput);
      llmJobSubmissionSchema.parse(submission);
      const response = await input.submissionHandler(
        new Request("https://agent-router.invalid/api/llm-jobs", {
          method: "POST",
          headers: {
            authorization: `Bearer ${input.userAccessToken}`,
            "content-type": "application/json",
            "idempotency-key": idempotencyKey,
          },
          body: JSON.stringify(submission),
        }),
      );
      if (!response.ok) {
        const failure = z
          .object({ error: z.string() })
          .safeParse(await response.json().catch(() => null));
        throw new Error(
          failure.success ? failure.data.error : "Job creation failed",
        );
      }
      const job = submittedJobSchema.parse(await response.json());
      return createLlmJobOutputSchema.parse({
        tool: "create_llm_job",
        job: { ...job, instanceId: submission.instanceId },
      });
    },
  };
}

function publicInstance(instance: RunnableLlmInstance) {
  return {
    id: instance.id,
    name: instance.name,
    provider: instance.provider,
    model: instance.model_id,
    capabilities: instance.capabilities,
    privacy: instance.privacy,
    inputPriceTinybarsPerMillionTokens:
      instance.input_price_tinybar_per_million,
    outputPriceTinybarsPerMillionTokens:
      instance.output_price_tinybar_per_million,
    priceSyncedAt: instance.price_synced_at,
  };
}
