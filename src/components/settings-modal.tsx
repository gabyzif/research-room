"use client";

import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";

import { ApiCredentialsSettings, type ProviderId } from "@/components/api-credentials-settings";
import { LanguagePicker } from "@/components/language-picker";
import { ThemePicker, type Theme } from "@/components/theme-picker";
import { useTranslations } from "@/components/language-provider";

type Section = "room" | "appearance" | "connections" | "account";

function BriefingIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><path d="M3 2.5h7l3 3V13a.5.5 0 0 1-.5.5h-9.5a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5z" /><path d="M10 2.5V5.5h3M5 8h6M5 10.5h6M5 5.5h2" /></svg>; }
function PaletteIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><path d="M8 14.5c3.6 0 6.5-2.9 6.5-6.5S11.6 1.5 8 1.5 1.5 4.4 1.5 8c0 1.4 1.1 2.5 2.5 2.5h1a1 1 0 0 1 1 1v.5a1.5 1.5 0 0 0 2 1.5z" /><circle cx="5" cy="7" r=".8" /><circle cx="8" cy="4.5" r=".8" /><circle cx="11" cy="7" r=".8" /><circle cx="11" cy="10" r=".8" /></svg>; }
function PlugIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><path d="M6 1.5v3M10 1.5v3" /><rect x="4" y="4.5" width="8" height="5" rx="1" /><path d="M8 9.5v3a1.5 1.5 0 0 0 1.5 1.5" /></svg>; }
function UserIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><circle cx="8" cy="5.5" r="2.8" /><path d="M2.5 14c.5-2.5 2.8-4 5.5-4s5 1.5 5.5 4" /></svg>; }
function LogoutIcon() { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3" /><path d="M10.5 11l3-3-3-3M13.3 8H6" /></svg>; }

export function SettingsModal({ open, onClose, initialSection = "room", userEmail, userImage, instructions, onInstructionsChange, onSaveInstructions, savingInstructions, theme, onThemeChange, connectedProviders, onConnectedChange }: {
  open: boolean;
  onClose: () => void;
  initialSection?: Section;
  userEmail: string;
  userImage: string | null;
  instructions: string;
  onInstructionsChange: (value: string) => void;
  onSaveInstructions: () => void | Promise<void>;
  savingInstructions: boolean;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  connectedProviders: ProviderId[];
  onConnectedChange: (next: ProviderId[]) => void;
}) {
  const t = useTranslations();
  const [section, setSection] = useState<Section>(initialSection);
  const initial = userEmail.charAt(0).toUpperCase() || "?";

  useEffect(() => { if (open) setSection(initialSection); }, [open, initialSection]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;

  const sections: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: "room", label: t("settings.sectionRoom"), icon: <BriefingIcon /> },
    { id: "appearance", label: t("settings.sectionAppearance"), icon: <PaletteIcon /> },
    { id: "connections", label: t("settings.sectionConnections"), icon: <PlugIcon /> },
    { id: "account", label: t("settings.sectionAccount"), icon: <UserIcon /> },
  ];

  return (
    <div className="history-modal-overlay" onClick={onClose}>
      <div className="settings-modal" role="dialog" aria-modal="true" aria-label={t("settings.title")} onClick={(e) => e.stopPropagation()}>
        <aside className="settings-nav">
          <div className="settings-nav-header">{t("settings.title")}</div>
          <nav>
            {sections.map((s) => (
              <button key={s.id} type="button" className={`settings-nav-item${section === s.id ? " is-active" : ""}`} onClick={() => setSection(s.id)}>
                {s.icon}
                <span>{s.label}</span>
              </button>
            ))}
          </nav>
        </aside>
        <div className="settings-main">
          <button type="button" className="settings-close" aria-label={t("historial.renameCancel")} onClick={onClose}>&times;</button>

          {section === "room" && (
            <div className="settings-section">
              <h2 className="settings-section-title">{t("workbench.instructions")}</h2>
              <p className="settings-section-hint">{t("workbench.instructionsHint")}</p>
              <textarea value={instructions} onChange={(e) => onInstructionsChange(e.target.value)} placeholder={t("workbench.instructionsPlaceholder")} rows={8} className="workbench-instructions-textarea instructions-modal-textarea" />
              <div className="settings-row-actions">
                <button type="button" className="primary-button" onClick={onSaveInstructions} disabled={savingInstructions}>{savingInstructions ? t("document.saving") : t("document.save")}</button>
              </div>
            </div>
          )}

          {section === "appearance" && (
            <div className="settings-section">
              <h2 className="settings-section-title">{t("settings.sectionAppearance")}</h2>
              <div className="settings-field">
                <div className="settings-field-label">
                  <p className="settings-field-title">{t("settings.theme")}</p>
                  <p className="settings-field-hint">{t("settings.themeHint")}</p>
                </div>
                <ThemePicker theme={theme} onChange={onThemeChange} />
              </div>
              <div className="settings-field">
                <div className="settings-field-label">
                  <p className="settings-field-title">{t("userMenu.language")}</p>
                  <p className="settings-field-hint">{t("settings.languageHint")}</p>
                </div>
                <LanguagePicker />
              </div>
            </div>
          )}

          {section === "connections" && (
            <div className="settings-section">
              <h2 className="settings-section-title">{t("settings.sectionConnections")}</h2>
              <p className="settings-section-hint">{t("settings.connectionsHint")}</p>
              <div className="settings-connections">
                <ApiCredentialsSettings connected={connectedProviders} onConnectedChange={onConnectedChange} />
              </div>
            </div>
          )}

          {section === "account" && (
            <div className="settings-section">
              <h2 className="settings-section-title">{t("settings.sectionAccount")}</h2>
              <div className="settings-account-card">
                {userImage ? <img src={userImage} alt="" className="user-dropdown-avatar" /> : <span className="user-dropdown-avatar user-chip-avatar-fallback">{initial}</span>}
                <div>
                  <p className="settings-field-title">{userEmail}</p>
                  <p className="settings-field-hint">{t("settings.accountHint")}</p>
                </div>
              </div>
              <div className="settings-row-actions">
                <button type="button" className="secondary-button settings-logout" onClick={() => signOut({ callbackUrl: "/" })}>
                  <LogoutIcon />
                  {t("createRoom.signOut")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
