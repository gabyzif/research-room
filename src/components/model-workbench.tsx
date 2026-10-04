"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { type ProviderId } from "@/components/api-credentials-settings";
import { BrandLogo } from "@/components/brand-logo";
import { HistoryModal } from "@/components/history-modal";
import { SettingsModal } from "@/components/settings-modal";
import { type CompanionConfig, DEFAULT_COMPANIONS, mergeCompanions } from "@/lib/models/types";
import { ChatThread } from "@/components/chat-thread";
import { CompanionChip } from "@/components/companion-chip";
import { DocumentEditor } from "@/components/document-editor";
import { DriveButton } from "@/components/drive-button";
import { type ChatView, type UsageView } from "@/lib/models/view-types";
import { ModelComposer } from "@/components/model-composer";
import { useTranslations } from "@/components/language-provider";
import { SourceList } from "@/components/source-list";
import { type Theme } from "@/components/theme-picker";
import { UsagePanel } from "@/components/usage-panel";
import { UserMenu } from "@/components/user-menu";

type Proposal = { id?: string; operation: string; targetHeadingId: string; markdown: string; citationSourceIds: string[] };
export type DynamicModel = { modelId: string; label: string; inputCostPerMillion: number; outputCostPerMillion: number; costLabel: string; isFree: boolean };
type RightTab = "document" | "sources";
type PersistedWorkbench = { focused?: string; researchMode?: boolean; composer?: string; order?: string[]; theme?: Theme; splitPercent?: number; rightTab?: RightTab; document?: { markdown: string; revision: number } };

export function ModelWorkbench({ projectId, selectedModelIds, initialTitle, initialInstructions, initialCompanions, userEmail, userImage }: { projectId: string; selectedModelIds: string[]; initialTitle: string; initialInstructions: string; initialCompanions: unknown[]; userEmail: string; userImage: string | null }) {
  const t = useTranslations();
  const router = useRouter();
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [renamingRoom, setRenamingRoom] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [orderedModelIds, setOrderedModelIds] = useState(selectedModelIds);
  const [title, setTitle] = useState(initialTitle);
  const [instructions, setInstructions] = useState(initialInstructions);
  const [savingInstructions, setSavingInstructions] = useState(false);
  const [companions, setCompanions] = useState<CompanionConfig[]>(() => mergeCompanions(initialCompanions));
  const [focused] = useState(selectedModelIds[0]);
  const [researchMode, setResearchMode] = useState(true);
  const [composer, setComposer] = useState("");
  const [theme, setTheme] = useState<Theme>("dark");
  const [rightTab, setRightTab] = useState<RightTab>("document");
  const [messages, setMessages] = useState<Record<string, ChatView[]>>({});
  const [usage, setUsage] = useState<Record<string, UsageView>>({});
  const [proposals, setProposals] = useState<Record<string, Proposal | undefined>>({});
  const [citedSources, setCitedSources] = useState<Record<string, string[]>>({});
  const [draftDocument, setDraftDocument] = useState({ markdown: "", revision: 0 });
  const [sources, setSources] = useState<Array<{ id: string; title: string; url: string; apaCitation?: string | null }>>([]);
  const [busy, setBusy] = useState(false);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [documentLoading, setDocumentLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [splitPercent, setSplitPercent] = useState(35);
  const [resizing, setResizing] = useState(false);
  const [connectedProviders, setConnectedProviders] = useState<ProviderId[]>([]);
  const [credentialsLoaded, setCredentialsLoaded] = useState(false);
  const [dynamicModels, setDynamicModels] = useState<DynamicModel[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [roomList, setRoomList] = useState<Array<{ id: string; title: string; updatedAt: string }>>([]);
  const layoutRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  function stop() {
    abortRef.current?.abort();
  }

  const storageKey = `research-room:${projectId}`;

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem("research-room:sidebar");
      if (stored === "closed") setSidebarOpen(false);
    } catch { /* best-effort */ }
  }, []);

  function toggleSidebar() {
    setSidebarOpen((current) => {
      const next = !current;
      try { window.sessionStorage.setItem("research-room:sidebar", next ? "open" : "closed"); } catch { /* best-effort */ }
      return next;
    });
  }

  useEffect(() => {
    fetch("/api/projects").then((r) => r.ok ? r.json() : []).then((list) => { if (Array.isArray(list)) setRoomList(list); }).catch(() => {});
  }, []);

  async function renameRoom(id: string, newTitle: string) {
    const trimmed = newTitle.trim();
    setRenamingRoom(null);
    if (!trimmed) return;
    setRoomList((current) => current.map((r) => r.id === id ? { ...r, title: trimmed } : r));
    if (id === projectId) setTitle(trimmed);
    await fetch(`/api/projects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: trimmed }) });
  }

  async function deleteRoom(id: string) {
    if (!window.confirm(t("historial.deleteConfirm"))) return;
    const response = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (!response.ok) return;
    setRoomList((current) => current.filter((r) => r.id !== id));
    if (id === projectId) {
      const fallback = roomList.find((r) => r.id !== id);
      router.push(fallback ? `/projects/${fallback.id}` : "/");
    }
  }

  async function createQuickRoom() {
    if (creatingRoom) return;
    setCreatingRoom(true);
    try {
      const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: t("workbench.newRoomTitle"), brief: t("workbench.newRoomBrief"), selectedModelIds: orderedModelIds }) });
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.id) router.push(`/projects/${payload.id}`);
    } finally {
      setCreatingRoom(false);
    }
  }

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw) as PersistedWorkbench;
        if (saved.order?.length === selectedModelIds.length && new Set(saved.order).size === saved.order.length && saved.order.every((id) => selectedModelIds.includes(id))) setOrderedModelIds(saved.order);
        // focused state no longer drives UI — skip restoring it
        if (typeof saved.researchMode === "boolean") setResearchMode(saved.researchMode);
        if (typeof saved.composer === "string") setComposer(saved.composer);
        if (typeof saved.splitPercent === "number") setSplitPercent(saved.splitPercent);
        if (saved.theme === "dark" || saved.theme === "violet" || saved.theme === "light") setTheme(saved.theme);
        if (saved.rightTab === "document" || saved.rightTab === "sources") setRightTab(saved.rightTab);
        if (saved.document) setDraftDocument(saved.document);
      } else {
        const storedTheme = window.sessionStorage.getItem("research-room:theme");
        if (storedTheme === "dark" || storedTheme === "violet" || storedTheme === "light") setTheme(storedTheme);
      }
    } catch {
      // Local session persistence is best-effort.
    } finally {
      setHydrated(true);
    }
  }, [storageKey, selectedModelIds]);

  useEffect(() => {
    window.document.documentElement.dataset.theme = theme;
    if (!hydrated) return;
    window.sessionStorage.setItem(storageKey, JSON.stringify({ focused, researchMode, composer, order: orderedModelIds, theme, splitPercent, rightTab, document: draftDocument } satisfies PersistedWorkbench));
  }, [focused, researchMode, composer, orderedModelIds, theme, splitPercent, rightTab, draftDocument, hydrated, storageKey]);

  useEffect(() => {
    setTitle(initialTitle);
    setRenamingRoom(null);
    setMessages({});
    setProposals({});
    setSources([]);
    setCitedSources({});
  }, [projectId]);

  useEffect(() => {
    setDocumentLoading(true);
    Promise.all([
      fetch(`/api/projects/${projectId}/document`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/projects/${projectId}/messages`).then((r) => r.ok ? r.json() : null),
    ]).then(([doc, history]) => {
      if (doc) {
        setDraftDocument((current) => current.markdown ? current : { markdown: doc.markdown ?? "", revision: doc.revision ?? 0 });
        setSources(doc.sources ?? []);
      }
      if (history?.messages) {
        setMessages((current) => {
          const hasContent = Object.values(current).some((msgs) => msgs.length > 0);
          return hasContent ? current : (history.messages as Record<string, ChatView[]>);
        });
      }
    }).finally(() => setDocumentLoading(false));
  }, [projectId]);

  useEffect(() => {
    Promise.all([
      fetch("/api/settings/credentials").then((r) => r.ok ? r.json() : null),
      fetch("/api/models").then((r) => r.ok ? r.json() : null),
    ]).then(([creds, catalog]) => {
      if (creds?.connected) setConnectedProviders(creds.connected);
      if (catalog?.models) setDynamicModels(catalog.models as DynamicModel[]);
    }).finally(() => setCredentialsLoaded(true));
  }, []);

  useEffect(() => {
    if (!hydrated || documentLoading) return;
    const timer = setTimeout(() => { saveDocument(); }, 2000);
    return () => clearTimeout(timer);
  }, [draftDocument.markdown]);

  const participants = useMemo(() => orderedModelIds.map((modelId, index) => ({ modelId, companion: companions[index] ?? DEFAULT_COMPANIONS[index] })), [orderedModelIds, companions]);

  function updateSplit(clientX: number) {
    const container = layoutRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const percent = ((clientX - rect.left) / rect.width) * 100;
    setSplitPercent(Math.min(70, Math.max(20, percent)));
  }

  function nudgeSplit(delta: number) {
    setSplitPercent((current) => Math.min(70, Math.max(20, current + delta)));
  }

  async function saveCompanion(updated: CompanionConfig[]) {
    try {
      await fetch(`/api/projects/${projectId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companions: updated }) });
    } catch {
      // best-effort
    }
  }

  async function saveInstructions() {
    setSavingInstructions(true);
    try {
      await fetch(`/api/projects/${projectId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instructions }) });
    } finally {
      setSavingInstructions(false);
    }
  }

  async function changeModel(oldModelId: string, nextModelId: string) {
    if (oldModelId === nextModelId) return;
    const swap = (id: string) => id === oldModelId ? nextModelId : id === nextModelId ? oldModelId : id;
    const nextOrder = orderedModelIds.map(swap);
    setOrderedModelIds(nextOrder);
    // focused state no longer drives UI
    try {
      await fetch(`/api/projects/${projectId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selectedModelIds: nextOrder }) });
    } catch {
      // Best-effort persistence; local state already reflects the change.
    }
  }

  async function send(contentOverride?: string) {
    const content = contentOverride ?? composer.trim();
    if (!content || busy) return;
    const recipients = orderedModelIds;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setSendError(null);
    if (!contentOverride) setComposer("");
    setMessages((current) => {
      const next = { ...current };
      for (const modelId of recipients) next[modelId] = [...(next[modelId] ?? []), { role: "user", content }];
      return next;
    });
    setCitedSources((current) => {
      const next = { ...current };
      for (const modelId of recipients) delete next[modelId];
      return next;
    });
    try {
      const response = await fetch(`/api/projects/${projectId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content, recipientModelIds: recipients, researchMode }), signal: controller.signal });
      if (!response.ok || !response.body) throw new Error("No se recibió el stream de respuestas");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const event = chunk.match(/^event: (.+)\ndata: ([\s\S]+)$/);
          if (!event) continue;
          const [, eventName, rawData] = event;
          const data = JSON.parse(rawData) as Record<string, unknown>;
          const modelId = String(data.modelId ?? eventName.split(":")[1] ?? "");
          if (eventName.startsWith("searching:")) setActiveModelId(modelId);
          if (eventName.endsWith(":delta")) setMessages((current) => ({ ...current, [modelId]: [...(current[modelId] ?? []), { role: "assistant", content: String(data.delta ?? "") }] }));
          if (eventName.endsWith(":complete")) {
            setUsage((current) => ({ ...current, [modelId]: data.usage as UsageView }));
            const incomingProposal = data.proposal as Proposal | null;
            if (data.phase !== "synthesis" || incomingProposal !== null) {
              setProposals((current) => ({ ...current, [modelId]: incomingProposal ?? undefined }));
            }
            setCitedSources((current) => ({ ...current, [modelId]: (data.sourceIds as string[] | undefined) ?? [] }));
          }
          if (eventName === "failed") setSendError(String(data.error ?? "Error desconocido al contactar al modelo"));
        }
      }
      const documentResponse = await fetch(`/api/projects/${projectId}/document`);
      if (documentResponse.ok) {
        const value = await documentResponse.json();
        setSources(value.sources ?? []);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        // User stopped intentionally — keep partial response visible
      } else {
        setMessages((current) => Object.fromEntries(Object.entries(current).map(([modelId, turns]) => [modelId, recipients.includes(modelId) ? turns.slice(0, -1) : turns])));
        setProposals((current) => { const next = { ...current }; for (const id of recipients) next[id] = undefined; return next; });
        setSources((current) => current);
        setSendError(error instanceof Error ? error.message : "Error desconocido al enviar el mensaje");
        console.error(error);
      }
    } finally {
      setBusy(false);
      setActiveModelId(null);
      abortRef.current = null;
    }
  }

  function editLastMessage(newContent: string) {
    setMessages((current) => {
      const next: Record<string, ChatView[]> = {};
      for (const [modelId, msgs] of Object.entries(current)) {
        let lastUserIdx = -1;
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === "user") { lastUserIdx = i; break; }
        }
        next[modelId] = lastUserIdx >= 0 ? msgs.slice(0, lastUserIdx) : msgs;
      }
      return next;
    });
    setProposals({});
    send(newContent);
  }


  async function saveDocument() {
    setSaving(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/document`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ markdown: draftDocument.markdown, baseRevision: draftDocument.revision }) });
      if (response.ok) {
        const value = await response.json();
        setDraftDocument({ markdown: value.markdown, revision: value.revision });
      } else if (response.status === 409) {
        // Revision conflict — fetch the latest and merge by keeping user's markdown but updating revision
        const latest = await fetch(`/api/projects/${projectId}/document`);
        if (latest.ok) {
          const value = await latest.json();
          setDraftDocument((current) => ({ markdown: current.markdown, revision: value.revision }));
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function reviewProposal(modelId: string, action: "accept" | "reject") {
    const proposal = proposals[modelId];
    if (!proposal?.id) {
      setSendError("No se pudo encontrar la propuesta para aplicar. Intentá enviar el mensaje de nuevo.");
      return;
    }
    const response = await fetch(`/api/projects/${projectId}/proposals/${proposal.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    if (response.ok) {
      setProposals((current) => ({ ...current, [modelId]: undefined }));
      if (action === "accept") setComposer("");
      const documentResponse = await fetch(`/api/projects/${projectId}/document`);
      if (documentResponse.ok) {
        const value = await documentResponse.json();
        setDraftDocument({ markdown: value.markdown, revision: value.revision });
        setSources(value.sources ?? []);
      }
      return;
    }
    if (response.status === 409) {
      setSendError(t("proposal.conflict"));
      setProposals((current) => ({ ...current, [modelId]: undefined }));
    } else {
      const payload = await response.json().catch(() => null);
      setSendError(payload?.error ?? t("proposal.error"));
    }
  }

  return <main className="workspace-shell min-h-screen px-4 py-6 lg:px-8">{!credentialsLoaded ? null : connectedProviders.length === 0 ? <div className="workbench-gate w-full"><p className="workbench-gate-title">{t("account.gateTitle")}</p><p className="workbench-gate-copy">{t("account.gateCopy")}</p></div> : <div className="workspace-body w-full">{!sidebarOpen && <aside className="workspace-rail"><BrandLogo compact title={t("workbench.backHome")} /><button type="button" className="workspace-rail-btn" aria-label={t("workbench.sidebarToggle")} onClick={toggleSidebar} title={t("workbench.sidebarToggle")}><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="2" y="3" width="14" height="12" rx="2" /><path d="M7 3v12" /></svg></button><button type="button" className="workspace-rail-btn" aria-label={t("historial.newRoom")} title={t("historial.newRoom")} disabled={creatingRoom} onClick={createQuickRoom}><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M12.5 2.5l3 3-8 8-4 1 1-4 8-8z" /></svg></button><button type="button" className="workspace-rail-btn" title={t("workbench.manageRooms")} aria-label={t("workbench.manageRooms")} onClick={() => setHistoryModalOpen(true)}><svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="8" cy="8" r="5" /><path d="M12 12l3.5 3.5" /></svg></button><div className="workspace-rail-spacer" /><UserMenu userEmail={userEmail} userImage={userImage} onOpenSettings={() => setSettingsOpen(true)} /></aside>}{sidebarOpen && <aside className="workspace-sidebar"><div className="workspace-sidebar-brand"><BrandLogo title={t("workbench.backHome")} /></div><div className="workspace-sidebar-header"><span className="workspace-sidebar-title">{t("historial.eyebrow")}</span><div className="workspace-sidebar-header-actions"><button type="button" className="workspace-sidebar-new" title={t("historial.newRoom")} disabled={creatingRoom} onClick={createQuickRoom}>+</button><button type="button" className="workspace-sidebar-collapse" title={t("workbench.sidebarCollapse")} aria-label={t("workbench.sidebarCollapse")} onClick={toggleSidebar}>&#8676;</button></div></div><div className="workspace-sidebar-list">{roomList.map((room) => <div key={room.id} className="workspace-sidebar-item-wrap">{renamingRoom === room.id ? <input autoFocus className="workspace-sidebar-rename-input" value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} onBlur={() => renameRoom(room.id, renameDraft)} onKeyDown={(e) => { if (e.key === "Enter") renameRoom(room.id, renameDraft); if (e.key === "Escape") setRenamingRoom(null); }} /> : <Link href={`/projects/${room.id}`} title={room.title} className={room.id === projectId ? "workspace-sidebar-item is-active" : "workspace-sidebar-item"}>{room.title}</Link>}<button type="button" className="workspace-sidebar-item-action" aria-label={t("historial.rename")} onClick={(e) => { e.preventDefault(); setRenameDraft(room.title); setRenamingRoom(room.id); }}><svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M7 1.5l2.5 2.5-6 6-3 .5.5-3 6-6z" /></svg></button><button type="button" className="workspace-sidebar-item-action workspace-sidebar-item-action--danger" aria-label={t("historial.delete")} onClick={(e) => { e.preventDefault(); deleteRoom(room.id); }}><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" /></svg></button></div>)}</div><button type="button" className="workspace-sidebar-manage" onClick={() => setHistoryModalOpen(true)}>{t("workbench.manageRooms")}</button><div className="workspace-sidebar-footer"><UsagePanel usage={usage} /><UserMenu expanded userEmail={userEmail} userImage={userImage} onOpenSettings={() => setSettingsOpen(true)} /></div></aside>}<div className="workspace-layout-v2"><div ref={layoutRef} className={resizing ? "workspace-columns is-resizing" : "workspace-columns"}><section className="workspace-panel model-panel" style={{ flex: `0 0 ${splitPercent}%` }}><div className="companion-bar">{orderedModelIds.map((modelId, index) => <CompanionChip key={modelId} modelId={modelId} index={index} companion={companions[index] ?? DEFAULT_COMPANIONS[index]} onCompanionChange={(updated) => { const next = companions.map((c) => c.slot === updated.slot ? updated : c); setCompanions(next); saveCompanion(next); }} onChangeModel={(nextModelId) => changeModel(modelId, nextModelId)} connectedProviders={connectedProviders} dynamicModels={dynamicModels} />)}</div><ChatThread messages={messages} orderedModelIds={orderedModelIds} participants={participants} activeModelId={activeModelId} loading={busy} usage={usage} proposals={proposals} citedSources={citedSources} sources={sources} onAccept={(modelId) => reviewProposal(modelId, "accept")} onReject={(modelId) => reviewProposal(modelId, "reject")} onEditMessage={editLastMessage} /></section><div className="panel-resizer" role="separator" aria-orientation="vertical" aria-label="Cambiar tamaño de columnas" aria-valuenow={Math.round(splitPercent)} aria-valuemin={20} aria-valuemax={70} tabIndex={0} onPointerDown={(event) => { setResizing(true); (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (resizing) updateSplit(event.clientX); }} onPointerUp={() => setResizing(false)} onPointerCancel={() => setResizing(false)} onKeyDown={(event) => { if (event.key === "ArrowLeft") nudgeSplit(-2); if (event.key === "ArrowRight") nudgeSplit(2); if (event.key === "Home") setSplitPercent(20); if (event.key === "End") setSplitPercent(70); }}><span>&#8942;</span></div><section className="workspace-panel document-panel-column"><div className="document-header-bar"><div className="workspace-tabs-list" role="tablist" aria-label="Contenido del panel derecho"><button type="button" role="tab" aria-selected={rightTab === "document"} className={rightTab === "document" ? "workspace-tab-v2 is-active" : "workspace-tab-v2"} onClick={() => setRightTab("document")}>{t("workbench.tabDocument")}</button><button type="button" role="tab" aria-selected={rightTab === "sources"} className={rightTab === "sources" ? "workspace-tab-v2 is-active" : "workspace-tab-v2"} onClick={() => setRightTab("sources")}>{t("workbench.tabSources")} <span>{sources.length}</span></button></div><div className="document-header-actions"><DriveButton projectId={projectId} onImported={(markdown, revision) => setDraftDocument({ markdown, revision })} onBeforeExport={saveDocument} /></div></div>{rightTab === "document" ? <div className={documentLoading ? "document-loading" : "workspace-tabpanel"} role="tabpanel"><DocumentEditor markdown={draftDocument.markdown} onChange={(markdown) => setDraftDocument((current) => ({ ...current, markdown }))} /></div> : <div className="workspace-tabpanel" role="tabpanel"><SourceList sources={sources} /></div>}</section></div><div className="workspace-chat-row">{sendError && <p className="error-banner">{sendError}</p>}<ModelComposer researchMode={researchMode} value={composer} onChange={setComposer} onResearchModeChange={setResearchMode} onSend={send} onStop={stop} disabled={busy} /></div></div></div>}<HistoryModal open={historyModalOpen} onClose={() => setHistoryModalOpen(false)} currentProjectId={projectId} /><SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} userEmail={userEmail} userImage={userImage} instructions={instructions} onInstructionsChange={setInstructions} onSaveInstructions={saveInstructions} savingInstructions={savingInstructions} theme={theme} onThemeChange={setTheme} connectedProviders={connectedProviders} onConnectedChange={setConnectedProviders} /></main>;
}
