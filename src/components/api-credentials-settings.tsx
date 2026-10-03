"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "@/components/language-provider";

export type ProviderId = "openrouter" | "openai" | "anthropic";
type AdvancedProviderId = "openai" | "anthropic";

export function ApiCredentialsSettings({ connected, onConnectedChange }: { connected: ProviderId[]; onConnectedChange: (next: ProviderId[]) => void }) {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [inputs, setInputs] = useState<Record<AdvancedProviderId, string>>({ openai: "", anthropic: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const openrouterStatus = searchParams.get("openrouter");

  const advancedProviders: { id: AdvancedProviderId; label: string; placeholder: string }[] = [
    { id: "openai", label: "OpenAI", placeholder: "sk-..." },
    { id: "anthropic", label: "Anthropic (Claude)", placeholder: "sk-ant-..." },
  ];

  useEffect(() => {
    if (!openrouterStatus) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("openrouter");
    router.replace(url.pathname + url.search);
  }, [openrouterStatus, router]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function connectAdvanced(provider: AdvancedProviderId) {
    const apiKey = inputs[provider].trim();
    if (!apiKey) return;
    setBusy(provider);
    try {
      const response = await fetch("/api/settings/credentials", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, apiKey }) });
      if (response.ok) {
        onConnectedChange(connected.includes(provider) ? connected : [...connected, provider]);
        setInputs((current) => ({ ...current, [provider]: "" }));
      }
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(provider: ProviderId) {
    setBusy(provider);
    try {
      const response = await fetch("/api/settings/credentials", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider }) });
      if (response.ok) onConnectedChange(connected.filter((item) => item !== provider));
    } finally {
      setBusy(null);
    }
  }

  const openrouterConnected = connected.includes("openrouter");
  const providerLabels: Record<ProviderId, string> = { openrouter: "OpenRouter", openai: "OpenAI", anthropic: "Anthropic" };
  const chipLabel = connected.length > 0 ? providerLabels[openrouterConnected ? "openrouter" : connected[0]] : t("account.connect");

  return (
    <div className="account-menu" ref={menuRef}>
      <button type="button" onClick={() => setOpen((value) => !value)} className={connected.length > 0 ? "account-chip is-connected" : "account-chip"}>
        <span className="account-chip-dot" />{chipLabel}<span className="account-chip-caret">⌄</span>
      </button>
      {open && <div className="account-dropdown">
        <p className="account-dropdown-hint">{t("account.hint")}</p>

        {openrouterStatus === "connected" && <p className="api-credential-feedback api-credential-feedback-ok">{t("account.openrouterConnected")}</p>}
        {openrouterStatus === "error" && <p className="api-credential-feedback api-credential-feedback-error">{t("account.openrouterError")}</p>}

        <div className="api-credential-row api-credential-row-primary">
          <span className="api-credential-label">OpenRouter</span>
          {openrouterConnected ? (
            <div className="api-credential-status">
              <span className="api-credential-connected">{t("account.connected")}</span>
              <button type="button" onClick={() => disconnect("openrouter")} disabled={busy === "openrouter"} className="secondary-button">{t("account.disconnect")}</button>
            </div>
          ) : (
            <a href="/api/settings/credentials/openrouter/connect" className="primary-button">{t("account.connectOpenRouter")}</a>
          )}
        </div>

        <details className="api-credentials-advanced">
          <summary>{t("account.advanced")}</summary>
          <div className="api-credentials-list">
            {advancedProviders.map((provider) => {
              const isConnected = connected.includes(provider.id);
              return (
                <div key={provider.id} className="api-credential-row">
                  <span className="api-credential-label">{provider.label}</span>
                  {isConnected ? (
                    <div className="api-credential-status">
                      <span className="api-credential-connected">{t("account.connected")}</span>
                      <button type="button" onClick={() => disconnect(provider.id)} disabled={busy === provider.id} className="secondary-button">{t("account.disconnect")}</button>
                    </div>
                  ) : (
                    <div className="api-credential-status">
                      <input type="password" value={inputs[provider.id]} onChange={(event) => setInputs((current) => ({ ...current, [provider.id]: event.target.value }))} placeholder={provider.placeholder} className="text-input" />
                      <button type="button" onClick={() => connectAdvanced(provider.id)} disabled={busy === provider.id || !inputs[provider.id].trim()} className="secondary-button">{t("account.connectButton")}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      </div>}
    </div>
  );
}
