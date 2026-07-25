import type { LanguageModel } from "ai";
import { generateText, Output } from "ai";
import type { ZodType } from "zod";

export interface StructuredGenerationRequest<T> {
  name: string;
  schema: ZodType<T>;
  prompt: string;
  timeoutMs: number;
}

export type StructuredGenerator = <T>(
  request: StructuredGenerationRequest<T>,
) => Promise<T>;

export function createAiSdkGenerator(
  model: LanguageModel,
): StructuredGenerator {
  return async <T>(request: StructuredGenerationRequest<T>) => {
    const result = await generateText({
      model,
      output: Output.object({
        schema: request.schema,
        name: request.name,
      }),
      prompt: request.prompt,
      temperature: 0,
      maxRetries: 1,
      timeout: { totalMs: request.timeoutMs },
    });

    return result.output;
  };
}
