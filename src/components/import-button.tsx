"use client";

import { useEffect, useRef, useState } from "react";

import { useTranslations } from "@/components/language-provider";

export function ImportButton({ projectId, onImported }: { projectId: string; onImported: (markdown: string, revision: number) => void }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function importDocument() {
    if (!url.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ googleDocUrl: url.trim() }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) { setError(payload?.error ?? t("workbench.importError")); return; }
      onImported(payload.markdown, payload.revision);
      setOpen(false);
      setUrl("");
    } catch {
      setError(t("workbench.importError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="import-button-wrap" ref={wrapRef}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="doc-icon-btn" title={t("workbench.import")} aria-label={t("workbench.import")}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <path d="M8 10V2M8 10l-3-3M8 10l3-3" />
          <path d="M2 11v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" />
        </svg>
      </button>
      {open && (
        <div className="import-popover" role="dialog" aria-label={t("workbench.import")}>
          <p className="import-popover-title">{t("workbench.importTitle")}</p>
          <input
            autoFocus
            type="url"
            className="text-input"
            placeholder="https://docs.google.com/document/d/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") importDocument(); if (e.key === "Escape") setOpen(false); }}
          />
          {error && <p className="import-popover-error">{error}</p>}
          <p className="import-popover-hint">{t("workbench.importHint")}</p>
          <div className="import-popover-actions">
            <button type="button" className="secondary-button" onClick={() => setOpen(false)} disabled={busy}>{t("historial.renameCancel")}</button>
            <button type="button" className="primary-button" onClick={importDocument} disabled={busy || !url.trim()}>{busy ? t("document.saving") : t("workbench.importConfirm")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
