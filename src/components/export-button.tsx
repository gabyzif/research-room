"use client";
import { useState } from "react";

import { useTranslations } from "@/components/language-provider";

export function ExportButton({ projectId, onBeforeExport }: { projectId: string; onBeforeExport: () => Promise<void> }) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);

  async function exportDocument() {
    setBusy(true);
    try {
      await onBeforeExport();
      const response = await fetch(`/api/projects/${projectId}/export`, { method: "POST" });
      const payload = await response.json();
      if (response.ok && payload.url) window.open(payload.url, "_blank");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={exportDocument} disabled={busy} className="doc-icon-btn" title={t("workbench.exportHint")} aria-label={t("workbench.export")}>
      {busy ? (
        <span className="button-spinner" />
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <path d="M8 2v8M8 2L5 5M8 2l3 3" />
          <path d="M2 11v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2" />
        </svg>
      )}
    </button>
  );
}
