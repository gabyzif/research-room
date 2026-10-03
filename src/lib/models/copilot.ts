import { decryptSecret } from "@/lib/crypto";
import type { ModelAdapter, ModelMessage, ModelRunOutput } from "@/lib/models/types";

export type CopilotSdkRequest = {
  accessToken: string;
  modelId: string;
  messages: ModelMessage[];
  documentMarkdown: string;
  onDelta?: (delta: string) => void;
};

export type CopilotSdkResult = {
  content: string;
  inputTokens?: number;
  outputTokens?: number;
  credits?: number;
  sourceIds?: string[];
};

export type CopilotSdkTransport = (request: CopilotSdkRequest) => Promise<CopilotSdkResult>;

async function githubAccessToken(userId: string): Promise<string> {
  const { prisma } = await import("@/lib/db");
  const account = await prisma.oAuthAccount.findFirst({
    where: { userId, provider: "github" },
    select: { encryptedAccessToken: true },
  });
  if (!account?.encryptedAccessToken) throw new Error("GitHub/Copilot is not connected for this user");
  return decryptSecret(account.encryptedAccessToken);
}

function unavailableTransport(): CopilotSdkTransport {
  return async () => {
    throw new Error("Copilot SDK transport is not configured. Install/configure the Copilot SDK before enabling this provider.");
  };
}

export function createCopilotAdapter(transport: CopilotSdkTransport = unavailableTransport()): ModelAdapter {
  return {
    provider: "copilot",

    async run(input): Promise<ModelRunOutput> {
      if (!input.selectedModelIds?.includes(input.modelId)) {
        throw new Error(`Model ${input.modelId} is not selected for this project`);
      }
      if (!input.userId) throw new Error("A signed-in user is required for Copilot");

      const result = await transport({
        accessToken: await githubAccessToken(input.userId),
        modelId: input.modelId,
        messages: input.messages,
        documentMarkdown: input.documentMarkdown,
      });
      const validSourceIds = new Set(input.sources.map((source) => source.id));
      const sourceIds = (result.sourceIds ?? []).filter((sourceId) => validSourceIds.has(sourceId));
      const output: ModelRunOutput = {
        provider: "copilot",
        modelId: input.modelId,
        content: result.content,
        sourceIds,
        usage: {
          inputTokens: result.inputTokens ?? 0,
          outputTokens: result.outputTokens ?? 0,
          costUsd: null,
          credits: result.credits ?? null,
        },
      };

      if (input.projectId) {
        const { prisma } = await import("@/lib/db");
        await prisma.usageRecord.create({
          data: {
            projectId: input.projectId,
            messageId: input.messageId,
            provider: output.provider,
            modelId: output.modelId,
            inputTokens: output.usage.inputTokens,
            outputTokens: output.usage.outputTokens,
            costUsd: null,
            credits: output.usage.credits,
          },
        });
      }

      return output;
    },
  };
}

export const copilotAdapter = createCopilotAdapter();
