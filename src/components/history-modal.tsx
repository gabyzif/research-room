"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useTranslations } from "@/components/language-provider";
import { HistoryList, type HistoryProject } from "@/components/history-list";

export function HistoryModal({ open, onClose, currentProjectId }: { open: boolean; onClose: () => void; currentProjectId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [projects, setProjects] = useState<HistoryProject[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/projects")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        if (!Array.isArray(data)) { setProjects([]); return; }
        setProjects(data.map((p) => ({
          id: p.id,
          title: p.title,
          brief: p.brief ?? "",
          createdAt: typeof p.createdAt === "string" ? p.createdAt : new Date(p.createdAt).toISOString(),
          updatedAt: typeof p.updatedAt === "string" ? p.updatedAt : new Date(p.updatedAt).toISOString(),
        })));
      })
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  function handleItemClick(projectId: string) {
    onClose();
    if (projectId !== currentProjectId) router.push(`/projects/${projectId}`);
  }

  function handleProjectDeleted(projectId: string) {
    if (projectId === currentProjectId) {
      onClose();
      router.push("/");
    }
  }

  return (
    <div className="history-modal-overlay" onClick={onClose}>
      <div className="history-modal" role="dialog" aria-modal="true" aria-label={t("historial.title")} onClick={(e) => e.stopPropagation()}>
        <div className="history-modal-header">
          <div>
            <p className="eyebrow">{t("historial.eyebrow")}</p>
            <h2 className="history-modal-title">{t("historial.title")}</h2>
          </div>
          <button type="button" className="history-modal-close" aria-label={t("historial.renameCancel")} onClick={onClose}>&times;</button>
        </div>
        <div className="history-modal-body">
          {loading && !projects ? <p className="muted-copy">…</p> : <HistoryList projects={projects ?? []} highlightProjectId={currentProjectId} onItemClick={handleItemClick} onProjectDeleted={handleProjectDeleted} />}
        </div>
      </div>
    </div>
  );
}
