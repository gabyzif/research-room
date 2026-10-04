"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

export function DocumentEditor({ markdown, onChange }: { markdown: string; onChange: (value: string) => void }) {
  const [editing, setEditing] = useState(false);

  return (
    <section className="document-panel">
      <div className="doc-mode-bar">
        <button
          type="button"
          className={editing ? "doc-mode-btn" : "doc-mode-btn is-active"}
          onClick={() => setEditing(false)}
        >
          Vista previa
        </button>
        <button
          type="button"
          className={editing ? "doc-mode-btn is-active" : "doc-mode-btn"}
          onClick={() => setEditing(true)}
        >
          Editar
        </button>
      </div>

      {editing ? (
        <textarea
          aria-label="Borrador del documento compartido"
          value={markdown}
          onChange={(e) => onChange(e.target.value)}
          className="document-textarea"
          autoFocus
        />
      ) : (
        <div className="document-preview">
          {markdown.trim() ? (
            <ReactMarkdown>{markdown}</ReactMarkdown>
          ) : (
            <p className="document-preview-empty">El documento está vacío. Activá el modo Editar para escribir o esperá a que los compañeros propongan contenido.</p>
          )}
        </div>
      )}
    </section>
  );
}
