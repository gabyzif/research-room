import { getUserApiKey } from "@/lib/models/credentials";
import { parseModelContent, recordUsage, systemPrompt } from "@/lib/models/shared-prompt";
import type { ModelAdapter, ModelRunOutput } from "@/lib/models/types";

const anthropicVersion = "2023-06-01";
const maxTokens = 4096;

type AnthropicMessagesResponse = {
  content: Array<{ type: string; text?: string }>;
  usage: { input_tokens: number; output_tokens: number };
};

export const anthropicDirectAdapter: ModelAdapter = {
  provider: "anthropic",

  async run(input): Promise<ModelRunOutput> {
    if (input.selectedModelIds && !input.selectedModelIds.includes(input.modelId)) {
      throw new Error(`Model ${input.modelId} is not selected for this project`);
    }
    if (!input.userId) throw new Error("A signed-in user is required to use Claude directly");
    const apiKey = await getUserApiKey(input.userId, "anthropic");
    if (!apiKey) throw new Error("Connect your Anthropic API key in account settings to use this model");

    const modelId = input.modelId.startsWith("anthropic-direct:") ? input.modelId.slice("anthropic-direct:".length) : input.modelId;
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": anthropicVersion },
      body: JSON.stringify({
        model: modelId,
        max_tokens: maxTokens,
        system: systemPrompt(input),
        messages: input.messages.map((message) => ({ role: message.role === "assistant" ? "assistant" : "user", content: message.content })),
      }),
    });
    if (!response.ok) throw new Error(`Anthropic API error: ${response.status} ${await response.text()}`);
    const payload = (await response.json()) as AnthropicMessagesResponse;
    const content = payload.content.find((block) => block.type === "text")?.text ?? "";
    const parsed = parseModelContent(content, input);

    const result: ModelRunOutput = {
      provider: "anthropic",
      modelId: input.modelId,
      ...parsed,
      usage: {
        inputTokens: payload.usage.input_tokens ?? 0,
        outputTokens: payload.usage.output_tokens ?? 0,
        costUsd: null,
        credits: null,
      },
    };

    await recordUsage({ projectId: input.projectId, messageId: input.messageId, provider: result.provider, modelId: result.modelId, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, costUsd: result.usage.costUsd, credits: result.usage.credits });

    return result;
  },
};
