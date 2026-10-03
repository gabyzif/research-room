import type { z } from "zod";

export type ModelRole = "system" | "user" | "assistant";

export type ModelMessage = {
  role: ModelRole;
  content: string;
};

export type SourceContext = {
  id: string;
  title: string;
  url: string;
  authors?: unknown;
  publishedAt?: string | null;
  apaCitation?: string | null;
};

export type ProposalOperation = "insert" | "replace" | "delete";

export type ModelProposal = {
  operation: ProposalOperation;
  targetHeadingId: string;
  markdown: string;
  citationSourceIds: string[];
  baseRevision: number;
};

export type ModelRunInput = {
  modelId: string;
  messages: ModelMessage[];
  documentMarkdown: string;
  sources: SourceContext[];
  selectedModelIds?: string[];
  baseRevision?: number;
  projectId?: string;
  messageId?: string;
  userId?: string;
  instructions?: string;
  researchMode?: boolean;
  peerResponses?: Array<{ modelId: string; content: string; proposal?: ModelProposal }>;
  companionName?: string;
  companionPersonality?: string;
};

export type CompanionConfig = { slot: number; name: string; personality: string; emoji: string };
export const DEFAULT_COMPANIONS: CompanionConfig[] = [
  { slot: 0, name: "Compañero 1", personality: "", emoji: "🤖" },
  { slot: 1, name: "Compañero 2", personality: "", emoji: "💡" },
];
export function mergeCompanions(raw: unknown[]): CompanionConfig[] {
  return DEFAULT_COMPANIONS.map((def) => {
    const entry = raw.find((r): r is Record<string, unknown> => typeof r === "object" && r !== null && (r as Record<string, unknown>).slot === def.slot);
    return entry ? { ...def, name: String(entry.name ?? def.name), personality: String(entry.personality ?? def.personality), emoji: String(entry.emoji ?? def.emoji) } : def;
  });
}

export type ModelUsage = {
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  credits: number | null;
};

export type ModelRunOutput = {
  provider: string;
  modelId: string;
  content: string;
  sourceIds: string[];
  proposal?: ModelProposal;
  usage: ModelUsage;
};

export interface ModelAdapter {
  provider: string;
  run(input: ModelRunInput): Promise<ModelRunOutput>;
}

export type ModelOutputSchema = z.ZodType<ModelRunOutput>;
