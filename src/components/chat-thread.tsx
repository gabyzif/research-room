"use client";

import ReactMarkdown from "react-markdown";
import { type CompanionConfig } from "@/lib/models/types";
import { ProposalCard, type ProposalView } from "@/components/proposal-card";
import { useTranslations } from "@/components/language-provider";
import { type ChatView, type UsageView, type SourceView } from "@/lib/models/view-types";

type ModelTurn = { question: string; answer: string };
function groupTurns(messages: ChatView[]): ModelTurn[] {
  const turns: ModelTurn[] = [];
  let current: ModelTurn | null = null;
  for (const msg of messages) {
    if (msg.role === "user") { current = { question: msg.content, answer: "" }; turns.push(current); }
    else if (current) current.answer += msg.content;
  }
  return turns;
}

type ThreadTurn = {
  userContent: string;
  responses: Array<{ modelId: string; content: string }>;
};

function buildThreadTurns(messages: Record<string, ChatView[]>, orderedModelIds: string[]): ThreadTurn[] {
  const primaryId = orderedModelIds[0];
  if (!primaryId) return [];
  const primaryTurns = groupTurns(messages[primaryId] ?? []);
  return primaryTurns.map((pt, turnIndex) => ({
    userContent: pt.question,
    responses: orderedModelIds.map((modelId) => ({
      modelId,
      content: groupTurns(messages[modelId] ?? [])[turnIndex]?.answer ?? "",
    })),
  }));
}

export function ChatThread({
  messages,
  orderedModelIds,
  participants,
  activeModelId,
  loading,
  usage,
  proposals,
  citedSources,
  sources,
  onAccept,
  onReject,
}: {
  messages: Record<string, ChatView[]>;
  orderedModelIds: string[];
  participants: Array<{ modelId: string; companion: CompanionConfig }>;
  activeModelId: string | null;
  loading: boolean;
  usage: Record<string, UsageView>;
  proposals: Record<string, ProposalView | undefined>;
  citedSources: Record<string, string[]>;
  sources: SourceView[];
  onAccept: (modelId: string) => void;
  onReject: (modelId: string) => void;
}) {
  const t = useTranslations();
  const turns = buildThreadTurns(messages, orderedModelIds);

  if (turns.length === 0) {
    return <div className="chat-thread chat-thread-empty"><div className="chat-thread-empty-inner"><span className="chat-thread-empty-icon" aria-hidden="true">💬</span><p className="empty-thread">{t("card.empty")}</p></div></div>;
  }

  const lastTurnIndex = turns.length - 1;
  const firstModelId = participants[0]?.modelId;

  return (
    <div className="chat-thread">
      {turns.map((turn, turnIndex) => {
        const isLastTurn = turnIndex === lastTurnIndex;
        return (
          <div key={turnIndex} className="ct-turn">
            <div className="ct-user-msg">{turn.userContent}</div>
            {turn.responses.map(({ modelId, content }) => {
              const participant = participants.find((p) => p.modelId === modelId);
              const companion = participant?.companion;
              const isActive = loading && isLastTurn && (activeModelId === modelId || (activeModelId === null && modelId === firstModelId));
              const isWaiting = loading && isLastTurn && !isActive && content === "";
              const isThinking = isActive && content === "";
              const modelUsage = isLastTurn ? usage[modelId] : usage[modelId];
              const proposal = isLastTurn ? proposals[modelId] : undefined;
              const cited = (citedSources[modelId] ?? [])
                .map((id) => sources.find((s) => s.id === id))
                .filter((s): s is SourceView => Boolean(s));

              return (
                <div key={modelId} className={`ct-model-msg${isWaiting ? " ct-waiting" : ""}`}>
                  <span className="ct-avatar">{companion?.emoji ?? "🤖"}</span>
                  <div className="ct-model-body">
                    <span className="ct-model-name">{companion?.name ?? modelId}</span>
                    {isWaiting ? (
                      <span className="ct-waiting-label"><span className="rr-thinking-dot" /> Esperando turno…</span>
                    ) : isThinking ? (
                      <p className="rr-thinking"><span className="rr-thinking-dot" />{t("card.thinking")}</p>
                    ) : content ? (
                      <div className="rr-a"><ReactMarkdown>{content}</ReactMarkdown></div>
                    ) : null}
                    {content && cited.length > 0 && (
                      <div className="rr-sources">
                        <p className="rr-sources-label">{t("card.sources")}</p>
                        <div className="rr-sources-list">
                          {cited.map((source, si) => (
                            <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer" className="rr-source-chip" title={source.apaCitation ?? source.title}>
                              [{si + 1}] {source.title.length > 40 ? `${source.title.slice(0, 40)}…` : source.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    {(content || modelUsage) && !isWaiting && modelUsage && (
                      <span className="ct-usage">
                        {modelUsage.costUsd === null ? t("card.costProvider") : `$${modelUsage.costUsd.toFixed(5)}`}
                      </span>
                    )}
                    {proposal && !isWaiting && (
                      <>
                        <button
                          type="button"
                          className="ct-contribute"
                          onClick={() => onAccept(modelId)}
                        >
                          {t("card.contribute")}
                        </button>
                        <ProposalCard
                          proposal={proposal}
                          onAccept={() => onAccept(modelId)}
                          onReject={() => onReject(modelId)}
                        />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
