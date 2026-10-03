"use client";

export function DocumentEditor({ markdown, onChange }: { markdown: string; onChange: (value: string) => void }) {
  return <section className="document-panel"><textarea aria-label="Borrador del documento compartido" value={markdown} onChange={(event) => onChange(event.target.value)} className="document-textarea" /></section>;
}
