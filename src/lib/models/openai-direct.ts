import OpenAI from "openai";

import { getUserApiKey } from "@/lib/models/credentials";
import { parseModelContent, recordUsage, systemPrompt } from "@/lib/models/shared-prompt";
import type { ModelAdapter, ModelMessage, ModelRunOutput } from "@/lib/models/types";

export const openaiDirectAdapter: ModelAdapter = {
  provider: "openai",

  async run(input): Promise<ModelRunOutput> {
    if (input.selectedModelIds && !input.selectedModelIds.includes(input.modelId)) {
      throw new Error(`Model ${input.modelId} is not selected for this project`);
    }
    if (!input.userId) throw new Error("A signed-in user is required to use OpenAI directly");
    const apiKey = await getUserApiKey(input.userId, "openai");
    if (!apiKey) throw new Error("Connect your OpenAI API key in account settings to use this model");

    const modelId = input.modelId.startsWith("openai-direct:") ? input.modelId.slice("openai-direct:".length) : input.modelId;
    const messages: ModelMessage[] = [
      { role: "system", content: systemPrompt(input) },
      ...input.messages,
    ];
    const completion = await new OpenAI({ apiKey }).chat.completions.create({
      model: modelId,
      messages,
      temperature: 0.2,
    });
    const rawContent = completion.choices[0]?.message?.content;
    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent ?? "");
    const parsed = parseModelContent(content, input);
    const usage = completion.usage;

    const result: ModelRunOutput = {
      provider: "openai",
      modelId: input.modelId,
      ...parsed,
      usage: {
        inputTokens: usage?.prompt_tokens ?? 0,
        outputTokens: usage?.completion_tokens ?? 0,
        costUsd: null,
        credits: null,
      },
    };

    await recordUsage({ projectId: input.projectId, messageId: input.messageId, provider: result.provider, modelId: result.modelId, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, costUsd: result.usage.costUsd, credits: result.usage.credits });

    return result;
  },
};
