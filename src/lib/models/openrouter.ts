import OpenAI from "openai";

import { getUserApiKey } from "@/lib/models/credentials";
import { parseModelContent, recordUsage, systemPrompt } from "@/lib/models/shared-prompt";
import type { ModelAdapter, ModelMessage, ModelRunOutput } from "@/lib/models/types";
import { formatApa } from "@/lib/research/citations";

type UrlCitationAnnotation = { type: "url_citation"; url_citation: { url: string; title?: string } };

async function resolveApiKey(userId?: string): Promise<string> {
  if (userId) {
    const userKey = await getUserApiKey(userId, "openrouter");
    if (userKey) return userKey;
  }
  const fallback = process.env.OPENROUTER_API_KEY;
  if (!fallback) throw new Error("No OpenRouter API key available: connect one in your account settings, or set OPENROUTER_API_KEY");
  return fallback;
}

function openRouterClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXTAUTH_URL ?? "http://localhost:3000",
      "X-Title": "Research Room",
    },
  });
}

async function persistWebCitations(annotations: unknown, projectId: string | undefined, modelId: string): Promise<string[]> {
  if (!projectId || !Array.isArray(annotations)) return [];
  const { prisma } = await import("@/lib/db");
  const ids: string[] = [];
  for (const raw of annotations) {
    const annotation = raw as Partial<UrlCitationAnnotation>;
    if (annotation.type !== "url_citation" || !annotation.url_citation?.url) continue;
    const { url, title } = annotation.url_citation;
    const record = await prisma.source.upsert({
      where: { projectId_url: { projectId, url } },
      update: { modelId, title: title || url },
      create: { projectId, modelId, url, title: title || url, authors: [], apaCitation: formatApa({ title: title || url, url }), metadataStatus: "VERIFIED" },
    });
    ids.push(record.id);
  }
  return ids;
}

export const openRouterAdapter: ModelAdapter = {
  provider: "openrouter",

  async run(input): Promise<ModelRunOutput> {
    if (input.selectedModelIds && !input.selectedModelIds.includes(input.modelId)) {
      throw new Error(`Model ${input.modelId} is not selected for this project`);
    }

    const apiKey = await resolveApiKey(input.userId);
    const messages: ModelMessage[] = [
      { role: "system", content: systemPrompt(input) },
      ...input.messages,
    ];
    const modelSlug = input.researchMode ? `${input.modelId}:online` : input.modelId;
    const completion = await openRouterClient(apiKey).chat.completions.create({
      model: modelSlug,
      messages,
      temperature: 0.2,
    });
    const message = completion.choices[0]?.message;
    const rawContent = message?.content;
    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent ?? "");
    const webSourceIds = await persistWebCitations((message as { annotations?: unknown } | undefined)?.annotations, input.projectId, input.modelId);
    const parsed = parseModelContent(content, input);
    const sourceIds = webSourceIds.length > 0 ? [...new Set([...parsed.sourceIds, ...webSourceIds])] : parsed.sourceIds;
    const proposal = parsed.proposal && webSourceIds.length > 0
      ? { ...parsed.proposal, citationSourceIds: [...new Set([...parsed.proposal.citationSourceIds, ...webSourceIds])] }
      : parsed.proposal;
    const usage = completion.usage;
    const usageWithCost = usage as (typeof usage & { cost?: number }) | undefined;

    const result: ModelRunOutput = {
      provider: "openrouter",
      modelId: input.modelId,
      content: parsed.content,
      sourceIds,
      proposal,
      usage: {
        inputTokens: usage?.prompt_tokens ?? 0,
        outputTokens: usage?.completion_tokens ?? 0,
        costUsd: typeof usageWithCost?.cost === "number" ? usageWithCost.cost : null,
        credits: null,
      },
    };

    await recordUsage({ projectId: input.projectId, messageId: input.messageId, provider: result.provider, modelId: result.modelId, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, costUsd: result.usage.costUsd, credits: result.usage.credits });

    return result;
  },
};
