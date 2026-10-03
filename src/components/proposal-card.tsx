"use client";

export type ProposalView = { id?: string; operation: string; targetHeadingId: string; markdown: string; citationSourceIds: string[] };

export function ProposalCard({ proposal, onAccept, onReject }: { proposal: ProposalView; onAccept: () => void; onReject: () => void }) {
  return <div className="proposal-card"><p className="proposal-card-kicker">Sugerencia · {proposal.operation}</p><p className="proposal-card-markdown">{proposal.markdown}</p><p className="proposal-card-meta">Sección: {proposal.targetHeadingId} · {proposal.citationSourceIds.length} citas</p><div className="proposal-card-actions"><button onClick={onAccept} className="proposal-card-accept">Aceptar</button><button onClick={onReject} className="secondary-button">Rechazar</button></div></div>;
}
