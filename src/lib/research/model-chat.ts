import { MessageAuthorType, ProposalOperation } from "@prisma/client";

import { prisma } from "@/lib/db";
import { anthropicDirectAdapter } from "@/lib/models/anthropic-direct";
import { copilotAdapter } from "@/lib/models/copilot";
import { openaiDirectAdapter } from "@/lib/models/openai-direct";
import { openRouterAdapter } from "@/lib/models/openrouter";
import type { ModelAdapter, ModelMessage, SourceContext } from "@/lib/models/types";

type CompanionConfig = { name: string; personality: string; emoji: string };
function companionForSlot(companions: unknown[], slot: number): CompanionConfig {
  const defaults = [{ name: "Compañero 1", emoji: "🤖", personality: "" }, { name: "Compañero 2", emoji: "💡", personality: "" }];
  const entry = Array.isArray(companions) ? companions[slot] : undefined;
  if (entry && typeof entry === "object" && entry !== null && "name" in entry) {
    return { name: String((entry as Record<string, unknown>).name ?? defaults[slot].name), emoji: String((entry as Record<string, unknown>).emoji ?? defaults[slot].emoji), personality: String((entry as Record<string, unknown>).personality ?? "") };
  }
  return defaults[slot] ?? { name: `Compañero ${slot + 1}`, emoji: "🤖", personality: "" };
}
import { refinePrompt } from "@/lib/research/refine-prompt";

export type ModelChatInput = {
  projectId: string;
  userId: string;
  content: string;
  researchMode: boolean;
  recipientModelIds: string[];
  messageId?: string;
  adapters?: Record<string, ModelAdapter>;
};

export type ModelChatEvent = {
  event: string;
  data: Record<string, unknown>;
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function adapterFor(modelId: string, adapters?: Record<string, ModelAdapter>): ModelAdapter {
  if (adapters?.[modelId]) return adapters[modelId];
  if (modelId.startsWith("copilot:")) return copilotAdapter;
  if (modelId.startsWith("openai-direct:")) return openaiDirectAdapter;
  if (modelId.startsWith("anthropic-direct:")) return anthropicDirectAdapter;
  return openRouterAdapter;
}

function sourceContext(source: { id: string; title: string; url: string; authors: unknown; publishedAt: Date | null; apaCitation: string | null }): SourceContext {
  return {
    id: source.id,
    title: source.title,
    url: source.url,
    authors: source.authors,
    publishedAt: source.publishedAt?.toISOString() ?? null,
    apaCitation: source.apaCitation,
  };
}

function threadMessages(messages: Array<{ id: string; authorType: MessageAuthorType; modelId: string | null; recipientModelIds: unknown; content: string }>, modelId: string, contentOverrides?: Map<string, string>): ModelMessage[] {
  return messages
    .filter((message) => message.authorType === MessageAuthorType.MODEL ? message.modelId === modelId : stringArray(message.recipientModelIds).includes(modelId))
    .map((message) => ({ role: message.authorType === MessageAuthorType.USER ? "user" : "assistant", content: contentOverrides?.get(message.id) ?? message.content }));
}

async function persistModelOutput(args: {
  projectId: string;
  userMessageId: string;
  modelId: string;
  researchMode: boolean;
  output: Awaited<ReturnType<ModelAdapter["run"]>>;
}) {
  const modelMessage = await prisma.chatMessage.create({
    data: {
      projectId: args.projectId,
      authorType: MessageAuthorType.MODEL,
      modelId: args.modelId,
      recipientModelIds: [args.modelId],
      content: args.output.content,
      researchMode: args.researchMode,
    },
  });
  const response = await prisma.modelResponse.create({
    data: {
      messageId: modelMessage.id,
      modelId: args.modelId,
      content: args.output.content,
      sourceIds: args.output.sourceIds,
      inputTokens: args.output.usage.inputTokens,
      outputTokens: args.output.usage.outputTokens,
      costUsd: args.output.usage.costUsd,
      credits: args.output.usage.credits,
    },
  });

  for (const sourceId of args.output.sourceIds) {
    await prisma.citation.upsert({
      where: { sourceId_responseId_marker: { sourceId, responseId: response.id, marker: sourceId } },
      update: {},
      create: { sourceId, responseId: response.id, marker: sourceId },
    });
  }

  let proposalId: string | undefined;
  if (args.output.proposal) {
    const proposal = await prisma.documentProposal.create({
      data: {
        projectId: args.projectId,
        messageId: args.userMessageId,
        responseId: response.id,
        modelId: args.modelId,
        baseRevision: args.output.proposal.baseRevision,
        operation: args.output.proposal.operation.toUpperCase() as ProposalOperation,
        targetHeadingId: args.output.proposal.targetHeadingId,
        markdown: args.output.proposal.markdown,
        citationSourceIds: args.output.proposal.citationSourceIds,
      },
    });
    proposalId = proposal.id;
  }

  return { modelMessageId: modelMessage.id, responseId: response.id, proposalId };
}

export async function* runGroupChat(input: ModelChatInput): AsyncGenerator<ModelChatEvent> {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    include: { document: true, sources: true },
  });
  if (!project || project.ownerId !== input.userId) throw new Error("Project not found");

  const selectedModelIds = stringArray(project.selectedModelIds);
  if (input.recipientModelIds.length < 1 || input.recipientModelIds.length > 2 || input.recipientModelIds.some((modelId) => !selectedModelIds.includes(modelId))) {
    throw new Error("Recipients must be selected models for this project");
  }

  const userMessage = input.messageId
    ? await prisma.chatMessage.findUniqueOrThrow({ where: { id: input.messageId } })
    : await prisma.chatMessage.create({
        data: {
          projectId: input.projectId,
          authorType: MessageAuthorType.USER,
          recipientModelIds: input.recipientModelIds,
          content: input.content,
          researchMode: input.researchMode,
        },
      });

  const existingMessages = await prisma.chatMessage.findMany({ where: { projectId: input.projectId }, orderBy: { createdAt: "asc" } });
  const documentMarkdown = project.document?.markdown ?? "";
  const baseRevision = project.document?.revision ?? 0;
  const baseSources = project.sources.map(sourceContext);

  const refinedContent = await refinePrompt(input.content, { projectTitle: project.title, projectBrief: project.brief, userId: input.userId });
  const contentOverrides = new Map([[userMessage.id, refinedContent]]);

  const companionsList = Array.isArray(project.companions) ? project.companions : [];
  const modelResults: Array<{ modelId: string; output: Awaited<ReturnType<ModelAdapter["run"]>>; persisted: Awaited<ReturnType<typeof persistModelOutput>> }> = [];

  for (let i = 0; i < input.recipientModelIds.length; i++) {
    const modelId = input.recipientModelIds[i];
    const companion = companionForSlot(companionsList, i);

    const peerResponses = modelResults.map((prev, prevIndex) => ({
      modelId: companionForSlot(companionsList, prevIndex).name,
      content: prev.output.content,
      proposal: prev.output.proposal,
    }));

    yield { event: `searching:${modelId}`, data: { modelId, active: input.researchMode } };

    let output: Awaited<ReturnType<ModelAdapter["run"]>>;
    try {
      output = await adapterFor(modelId, input.adapters).run({
        modelId,
        selectedModelIds,
        messages: threadMessages(existingMessages, modelId, contentOverrides),
        documentMarkdown,
        sources: baseSources,
        baseRevision,
        projectId: input.projectId,
        messageId: userMessage.id,
        userId: input.userId,
        instructions: project.instructions,
        researchMode: input.researchMode,
        companionName: companion.name,
        companionPersonality: companion.personality,
        peerResponses: peerResponses.length > 0 ? peerResponses : undefined,
      });
    } catch (err) {
      yield { event: "failed", data: { error: err instanceof Error ? err.message : "Model request failed" } };
      continue;
    }

    const persisted = await persistModelOutput({ projectId: input.projectId, userMessageId: userMessage.id, modelId, researchMode: input.researchMode, output });
    modelResults.push({ modelId, output, persisted });

    yield { event: `model:${modelId}:delta`, data: { modelId, delta: output.content } };
    yield {
      event: `model:${modelId}:complete`,
      data: {
        modelId,
        responseId: persisted.responseId,
        sourceIds: output.sourceIds,
        proposal: output.proposal ? { ...output.proposal, id: persisted.proposalId } : null,
        usage: output.usage,
      },
    };
  }
}
