"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { LanguagePicker } from "@/components/language-picker";
import { useLanguage, useTranslations } from "@/components/language-provider";
import { ThemePicker, type Theme } from "@/components/theme-picker";

export type HistoryProject = { id: string; title: string; brief: string; createdAt: string; updatedAt: string };

function formatDate(iso: string, language: string): string {
  const date = new Date(iso);
  const locale = language === "en" ? "en-US" : language === "pt" ? "pt-BR" : "es-AR";
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function HistoryList({ projects: initialProjects, highlightProjectId, onItemClick, onProjectDeleted }: { projects: HistoryProject[]; highlightProjectId?: string; onItemClick?: (projectId: string) => void; onProjectDeleted?: (projectId: string) => void }) {
  const t = useTranslations();
  const { language } = useLanguage();
  const [projects, setProjects] = useState(initialProjects);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { setProjects(initialProjects); }, [initialProjects]);

  useEffect(() => {
    if (!openMenuId) return;
    function onClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpenMenuId(null);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [openMenuId]);

  function startRename(project: HistoryProject) {
    setRenamingId(project.id);
    setRenameValue(project.title);
    setOpenMenuId(null);
  }

  async function saveRename(id: string) {
    const title = renameValue.trim();
    if (!title) { setRenamingId(null); return; }
    setBusyId(id);
    try {
      const response = await fetch(`/api/projects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
      if (response.ok) setProjects((current) => current.map((p) => p.id === id ? { ...p, title } : p));
    } finally {
      setBusyId(null);
      setRenamingId(null);
    }
  }

  async function duplicateProject(id: string) {
    setOpenMenuId(null);
    setBusyId(id);
    try {
      const response = await fetch(`/api/projects/${id}/duplicate`, { method: "POST" });
      const copy = await response.json().catch(() => null);
      if (response.ok && copy?.id) {
        setProjects((current) => [{ id: copy.id, title: copy.title, brief: copy.brief, createdAt: copy.createdAt, updatedAt: copy.updatedAt }, ...current]);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function deleteProject(id: string) {
    setOpenMenuId(null);
    if (!window.confirm(t("historial.deleteConfirm"))) return;
    setBusyId(id);
    try {
      const response = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (response.ok) {
        setProjects((current) => current.filter((p) => p.id !== id));
        onProjectDeleted?.(id);
      }
    } finally {
      setBusyId(null);
    }
  }

  if (projects.length === 0) {
    return (
      <div className="history-empty">
        <p className="history-empty-title">{t("historial.empty")}</p>
        <Link href="/" className="primary-button">{t("historial.emptyCta")}</Link>
      </div>
    );
  }

  return (
    <ul className="history-list">
      {projects.map((project) => (
        <li key={project.id} className={`history-item-row${project.id === highlightProjectId ? " history-item-row-highlight" : ""}`}>
          {renamingId === project.id ? (
            <div className="history-item history-item-editing">
              <input
                autoFocus
                className="text-input history-rename-input"
                value={renameValue}
                maxLength={200}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveRename(project.id); if (e.key === "Escape") setRenamingId(null); }}
              />
              <div className="history-item-actions">
                <button type="button" className="secondary-button" disabled={busyId === project.id} onClick={() => saveRename(project.id)}>{t("historial.renameSave")}</button>
                <button type="button" className="secondary-button" disabled={busyId === project.id} onClick={() => setRenamingId(null)}>{t("historial.renameCancel")}</button>
              </div>
            </div>
          ) : (
            <>
              <Link href={`/projects/${project.id}`} className="history-item" onClick={(e) => { if (onItemClick) { e.preventDefault(); onItemClick(project.id); } }}>
                <div className="history-item-main">
                  <p className="history-item-title">{project.title}</p>
                  <p className="history-item-brief">{project.brief}</p>
                </div>
                <div className="history-item-meta">
                  <span className="history-item-date">{t("historial.updated")} {formatDate(project.updatedAt, language)}</span>
                  <span className="history-item-arrow">→</span>
                </div>
              </Link>
              <div className="history-item-menu-wrap" ref={openMenuId === project.id ? menuRef : undefined}>
                <button
                  type="button"
                  className="history-item-menu-btn"
                  aria-label={t("historial.rowMenu")}
                  aria-expanded={openMenuId === project.id}
                  disabled={busyId === project.id}
                  onClick={() => setOpenMenuId((current) => current === project.id ? null : project.id)}
                >
                  ⋯
                </button>
                {openMenuId === project.id && (
                  <div className="history-item-menu" role="menu">
                    <button type="button" role="menuitem" onClick={() => startRename(project)}>{t("historial.rename")}</button>
                    <button type="button" role="menuitem" onClick={() => duplicateProject(project.id)}>{t("historial.duplicate")}</button>
                    <button type="button" role="menuitem" className="history-item-menu-danger" onClick={() => deleteProject(project.id)}>{t("historial.delete")}</button>
                  </div>
                )}
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

export function HistorialView({ projects }: { projects: HistoryProject[] }) {
  const t = useTranslations();
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem("research-room:theme");
      if (stored === "dark" || stored === "violet" || stored === "light") setTheme(stored);
    } catch { /* best-effort */ }
  }, []);

  function chooseTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    try { window.sessionStorage.setItem("research-room:theme", nextTheme); } catch { /* best-effort */ }
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="history-shell">
      <header className="workspace-header-v2 w-full">
        <div className="workspace-header-title">
          <div className="workspace-brand"><span className="workspace-brand-dot" />RESEARCH ROOM &middot; {t("historial.eyebrow").toUpperCase()}</div>
          <h1>{t("historial.title")}</h1>
        </div>
        <div className="workspace-header-meta">
          <div className="header-meta-group">
            <Link href="/" className="workspace-history-link">{t("workbench.backHome")}</Link>
            <LanguagePicker />
            <ThemePicker theme={theme} onChange={chooseTheme} />
          </div>
          <span className="header-meta-divider" aria-hidden="true" />
          <Link href="/" className="primary-button history-new-room">{t("historial.newRoom")}</Link>
        </div>
      </header>

      <HistoryList projects={projects} />
    </div>
  );
}
