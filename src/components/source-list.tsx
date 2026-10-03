"use client";

export function SourceList({ sources }: { sources: Array<{ id: string; title: string; url: string; apaCitation?: string | null }> }) {
  return <section className="sources-panel"><p className="panel-kicker">Fuentes · APA</p>{sources.length === 0 ? <p className="sources-empty">Las fuentes verificadas aparecerán acá.</p> : <ol className="sources-list">{sources.map((source) => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a><p>{source.apaCitation ?? source.url}</p></li>)}</ol>}</section>;
}
