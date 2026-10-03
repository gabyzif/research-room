"use client";

import { useEffect, useRef, useState } from "react";

import { useTranslations } from "@/components/language-provider";

function DriveLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="drive-logo">
      <path d="M7.71 3.5l-7 12 3.44 6h7.71l-3.44-6 7-12z" fill="#1FA463" />
      <path d="M14.42 3.5h-6.71l7 12h6.71z" fill="#FFC107" />
      <path d="M4.15 21.5h13.42l3.44-6H7.59z" fill="#4285F4" />
    </svg>
  );
}

export function DriveButton({ projectId, onImported, onBeforeExport }: { projectId: string; onImported: (markdown: string, revision: number) => void; onBeforeExport: () => Promise<void> | void }) {
  const t = useTranslations();
  const [menuOpen, setMenuOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen && !importOpen) return;
    function onClickOutside(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) { setMenuOpen(false); setImportOpen(false); }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen, importOpen]);

  async function exportDocument() {
    setMenuOpen(false);
    setExportBusy(true);
    try {
      await onBeforeExport();
      const response = await fetch(`/api/projects/${projectId}/export`, { method: "POST" });
      const payload = await response.json();
      if (response.ok && payload.url) window.open(payload.url, "_blank");
    } finally {
      setExportBusy(false);
    }
  }

  function openImport() {
    setMenuOpen(false);
    setImportOpen(true);
    setError("");
  }

  async function importDocument() {
    if (!url.trim()) return;
    setImportBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/import`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ googleDocUrl: url.trim() }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) { setError(payload?.error ?? t("workbench.importError")); return; }
      onImported(payload.markdown, payload.revision);
      setImportOpen(false);
      setUrl("");
    } catch {
      setError(t("workbench.importError"));
    } finally {
      setImportBusy(false);
    }
  }

  const busy = exportBusy || importBusy;

  return (
    <div className="drive-button-wrap" ref={wrapRef}>
      <button type="button" onClick={() => setMenuOpen((v) => !v)} className="drive-button" disabled={busy} title={t("workbench.drive")} aria-label={t("workbench.drive")} aria-expanded={menuOpen}>
        {busy ? <span className="button-spinner" /> : <DriveLogo />}
        <span className="drive-button-caret" aria-hidden="true">⌄</span>
      </button>
      {menuOpen && (
        <div className="drive-menu" role="menu">
          <button type="button" role="menuitem" onClick={openImport}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M8 10V2M8 10l-3-3M8 10l3-3" /><path d="M2 11v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" /></svg>
            <span>{t("workbench.import")}</span>
          </button>
          <button type="button" role="menuitem" onClick={exportDocument}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M8 2v8M8 2L5 5M8 2l3 3" /><path d="M2 11v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" /></svg>
            <span>{t("workbench.export")}</span>
          </button>
        </div>
      )}
      {importOpen && (
        <div className="import-popover" role="dialog" aria-label={t("workbench.import")}>
          <p className="import-popover-title">{t("workbench.importTitle")}</p>
          <input
            autoFocus
            type="url"
            className="text-input"
            placeholder="https://docs.google.com/document/d/..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") importDocument(); if (e.key === "Escape") setImportOpen(false); }}
          />
          {error && <p className="import-popover-error">{error}</p>}
          <p className="import-popover-hint">{t("workbench.importHint")}</p>
          <div className="import-popover-actions">
            <button type="button" className="secondary-button" onClick={() => setImportOpen(false)} disabled={importBusy}>{t("historial.renameCancel")}</button>
            <button type="button" className="primary-button" onClick={importDocument} disabled={importBusy || !url.trim()}>{importBusy ? t("document.saving") : t("workbench.importConfirm")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
