"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { useEffect, useState } from "react";

import { LanguagePicker } from "@/components/language-picker";
import { useTranslations } from "@/components/language-provider";
import { ThemePicker, type Theme } from "@/components/theme-picker";
import { type ProviderId } from "@/components/api-credentials-settings";

const draftKey = "research-room:new-project";
const defaultTitle = "Agente de viajes para personas con mascotas";
const defaultBrief = "Investigar destinos, alojamientos, transporte y requisitos para viajar con mascotas, usando fuentes verificables y citas APA.";
const defaultModels = ["openai/gpt-4o-mini", "anthropic/claude-sonnet-5"];
const ARTIFACT_URL: string | null = null; // set once Artifact is deployed

type AdvancedProviderId = "openai" | "anthropic";

export function ProjectForm({ authenticated, userEmail, connectedProviders = [] }: { authenticated: boolean; userEmail?: string; connectedProviders?: ProviderId[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const [title, setTitle] = useState(defaultTitle);
  const [brief, setBrief] = useState(defaultBrief);
  const [theme, setTheme] = useState<Theme>("light");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [connected, setConnected] = useState<ProviderId[]>(connectedProviders);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedInputs, setAdvancedInputs] = useState<Record<AdvancedProviderId, string>>({ openai: "", anthropic: "" });
  const [advancedBusy, setAdvancedBusy] = useState<AdvancedProviderId | null>(null);

  const openrouterStatus = searchParams.get("openrouter");
  const [oauthResult, setOauthResult] = useState<"connected" | "error" | null>(null);
  const anyConnected = connected.length > 0;

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as { title?: string; brief?: string; theme?: Theme };
        if (draft.title) setTitle(draft.title);
        if (draft.brief) setBrief(draft.brief);
        if (draft.theme === "dark" || draft.theme === "violet" || draft.theme === "light") setTheme(draft.theme);
      }
    } catch { /* sessionStorage optional */ }
    finally { setHydrated(true); }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (!hydrated) return;
    window.sessionStorage.setItem(draftKey, JSON.stringify({ title, brief, theme }));
  }, [title, brief, theme, hydrated]);

  useEffect(() => {
    if (!openrouterStatus) return;
    if (openrouterStatus === "connected") {
      setConnected((prev) => prev.includes("openrouter") ? prev : [...prev, "openrouter"]);
      setOauthResult("connected");
    } else if (openrouterStatus === "error") {
      setOauthResult("error");
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("openrouter");
    router.replace(url.pathname + url.search);
  }, [openrouterStatus, router]);

  function chooseTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }

  async function connectAdvanced(provider: AdvancedProviderId) {
    const apiKey = advancedInputs[provider].trim();
    if (!apiKey) return;
    setAdvancedBusy(provider);
    try {
      const response = await fetch("/api/settings/credentials", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, apiKey }) });
      if (response.ok) {
        setConnected((current) => current.includes(provider) ? current : [...current, provider]);
        setAdvancedInputs((current) => ({ ...current, [provider]: "" }));
      }
    } finally {
      setAdvancedBusy(null);
    }
  }

  if (!authenticated) {
    return (
      <section className="login-shell rr-card">
        <div className="login-masthead">
          <div className="login-brand"><span className="login-brand-dot" />RESEARCH ROOM</div>
          <div className="login-masthead-meta">
            <span>{t("login.sala")}</span><span className="login-meta-sep">|</span>
            <LanguagePicker />
          </div>
        </div>
        <div className="login-body">
          <div className="login-body-main">
            <h1 className="login-hero">{t("login.hero")}</h1>
            <p className="login-copy-text">{t("login.copy")}</p>

            <div className="login-oauth">
              <button type="button" onClick={() => signIn("google")} className="oauth-button oauth-primary"><span className="oauth-icon-google" aria-hidden="true" />{t("login.google")}</button>
              <button type="button" onClick={() => signIn("github")} className="oauth-button oauth-secondary"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><circle cx="8" cy="8" r="6.5" /><path d="M6 11c-1.5.3-1.5-.7-2.1-1M11.5 12v-1.6c0-.5-.2-.8-.4-1 1.4-.15 2.9-.7 2.9-3.1 0-.7-.25-1.25-.65-1.7.07-.15.3-.8-.06-1.65 0 0-.55-.17-1.75.65a6 6 0 0 0-3.2 0c-1.2-.82-1.75-.65-1.75-.65-.35.85-.13 1.5-.06 1.65-.4.45-.65 1-.65 1.7 0 2.4 1.5 2.95 2.9 3.1-.18.16-.35.44-.4.85" /></svg>{t("login.github")}</button>
            </div>

            <ArtifactAlt label={t("login.artifactAlt")} soon={t("login.artifactSoon")} />

            <ThemePicker theme={theme} onChange={chooseTheme} />
          </div>

          <div className="landing-steps">
            <h2 className="landing-steps-title">{t("login.howTitle")}</h2>
            <ol className="landing-steps-list">
              <li className="landing-step"><span className="landing-step-num">1</span><div><p className="landing-step-title">{t("login.step1Title")}</p><p className="landing-step-copy">{t("login.step1Copy")}</p></div></li>
              <li className="landing-step"><span className="landing-step-num">2</span><div><p className="landing-step-title">{t("login.step2Title")}</p><p className="landing-step-copy">{t("login.step2Copy")}</p></div></li>
              <li className="landing-step"><span className="landing-step-num">3</span><div><p className="landing-step-title">{t("login.step3Title")}</p><p className="landing-step-copy">{t("login.step3Copy")}</p></div></li>
            </ol>
          </div>
        </div>
      </section>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setCreating(true);
    try {
      const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, brief, selectedModelIds: defaultModels }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setError(response.status === 401 ? t("createRoom.errorUnauthorized") : payload?.code === "DATABASE_UNAVAILABLE" ? t("createRoom.errorDatabase") : payload?.error?.formErrors?.join(", ") ?? t("createRoom.errorGeneric"));
        return;
      }
      window.sessionStorage.setItem("research-room:theme", theme);
      window.sessionStorage.removeItem(draftKey);
      router.push(`/projects/${payload.id}`);
    } catch {
      setError(t("createRoom.errorNetwork"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={submit} className="surface-card project-form">
      <div className="form-heading">
        <div>
          <p className="eyebrow">{t("createRoom.eyebrow")}</p>
          <h1>{t("createRoom.title")}</h1>
          <div className="session-badge"><span>✓</span> {t("createRoom.sessionActive", { email: userEmail ?? "" })}<Link href="/historial">Historial</Link><button type="button" onClick={() => signOut({ callbackUrl: "/" })}>{t("createRoom.signOut")}</button></div>
        </div>
        <div className="form-heading-controls"><LanguagePicker /><ThemePicker theme={theme} onChange={chooseTheme} /></div>
      </div>

      {oauthResult === "connected" && <p className="landing-toast landing-toast-ok">{t("createRoom.oauthOk")}</p>}
      {oauthResult === "error" && <p className="landing-toast landing-toast-err">{t("createRoom.oauthErr")} — revisá el terminal del servidor para ver el detalle.</p>}

      {anyConnected ? (
        <div className="landing-connect-ok">
          <span className="landing-connect-dot" />
          {t("createRoom.connectionOk")}
          <span className="landing-connect-providers">
            {connected.map((p) => p === "openrouter" ? "OpenRouter" : p === "openai" ? "OpenAI" : "Anthropic").join(" · ")}
          </span>
        </div>
      ) : (
        <div className="landing-connect-gate">
          <h2 className="landing-connect-title">{t("createRoom.connectTitle")}</h2>
          <p className="landing-connect-copy">{t("createRoom.connectCopy")}</p>
          <p className="landing-connect-hint">{t("createRoom.connectFree")}</p>
          <a href="/api/settings/credentials/openrouter/connect" className="primary-button landing-connect-btn">{t("account.connectOpenRouter")}</a>

          <details className="landing-connect-advanced" open={advancedOpen} onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}>
            <summary>{t("createRoom.advancedTitle")}</summary>
            <div className="landing-advanced-list">
              {(["openai", "anthropic"] as AdvancedProviderId[]).map((p) => (
                <div key={p} className="landing-advanced-row">
                  <span className="landing-advanced-label">{p === "openai" ? "OpenAI" : "Anthropic (Claude)"}</span>
                  <input type="password" value={advancedInputs[p]} onChange={(e) => setAdvancedInputs((c) => ({ ...c, [p]: e.target.value }))} placeholder={p === "openai" ? "sk-..." : "sk-ant-..."} className="text-input" />
                  <button type="button" onClick={() => connectAdvanced(p)} disabled={advancedBusy === p || !advancedInputs[p].trim()} className="secondary-button">{t("account.connectButton")}</button>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      <label className="field-label">{t("createRoom.titleLabel")}<input value={title} onChange={(event) => setTitle(event.target.value)} required className="text-input" /></label>
      <label className="field-label">{t("createRoom.briefLabel")}<textarea value={brief} onChange={(event) => setBrief(event.target.value)} required rows={4} className="text-input resize-y" /></label>
      <p className="muted-copy">{t("createRoom.defaultModelsHint")}</p>

      {error && <p className="error-banner">{error}</p>}

      <button type="submit" disabled={creating || !anyConnected} className="primary-button submit-button">
        {creating ? <><span className="button-spinner" /> {t("createRoom.submitting")}</> : t("createRoom.submit")}
      </button>
      {!anyConnected && <p className="landing-gate-hint">{t("createRoom.gateHint")}</p>}
      {creating && <div className="form-skeleton" aria-label={t("createRoom.loadingAria")}><span /><span /><span /></div>}

      <ArtifactAlt label={t("createRoom.artifactAlt")} soon={t("login.artifactSoon")} inline />
    </form>
  );
}

function ArtifactAlt({ label, soon, inline }: { label: string; soon: string; inline?: boolean }) {
  const disabled = !ARTIFACT_URL;
  const className = inline ? "landing-artifact-alt landing-artifact-alt-inline" : "landing-artifact-alt";
  if (disabled) {
    return (
      <div className={className}>
        <span className="landing-artifact-text">{label}</span>
        <span className="landing-artifact-soon">{soon}</span>
      </div>
    );
  }
  return (
    <a className={className} href={ARTIFACT_URL} target="_blank" rel="noreferrer">
      <span className="landing-artifact-text">{label}</span>
    </a>
  );
}
