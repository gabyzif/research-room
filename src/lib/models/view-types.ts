export type ChatView = { role: "user" | "assistant"; content: string };
export type UsageView = { inputTokens: number; outputTokens: number; costUsd: number | null; credits: number | null };
export type SourceView = { id: string; title: string; url: string; apaCitation?: string | null };
