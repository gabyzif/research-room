"use client";

import { useTranslations } from "@/components/language-provider";

export function UserMenu({ userEmail, userImage, onOpenSettings, expanded = false }: { userEmail: string; userImage: string | null; onOpenSettings: () => void; expanded?: boolean }) {
  const t = useTranslations();
  const initial = userEmail.charAt(0).toUpperCase() || "?";

  return (
    <div className="user-menu">
      <button type="button" onClick={onOpenSettings} className={`user-chip${expanded ? " user-chip-expanded" : ""}`} title={userEmail}>
        {userImage ? <img src={userImage} alt="" className="user-chip-avatar" /> : <span className="user-chip-avatar user-chip-avatar-fallback">{initial}</span>}
        {expanded && <span className="user-chip-email">{t("userMenu.options")}</span>}
        <span className="account-chip-caret">⌄</span>
      </button>
    </div>
  );
}
