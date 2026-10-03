"use client";
import { useTranslations } from "@/components/language-provider";

export function ModelComposer({ researchMode, value, onChange, onResearchModeChange, onSend, disabled }: { researchMode: boolean; value: string; onChange: (value: string) => void; onResearchModeChange: (value: boolean) => void; onSend: () => void; disabled: boolean }) {
  const t = useTranslations();

  return (
    <div className="composer-panel">
      <div className="composer-row">
        <textarea
          aria-label="Pregunta para los compañeros"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSend(); }}
          placeholder={t("composer.placeholder")}
          rows={3}
          disabled={disabled}
          className="composer-textarea"
        />
        <div className="composer-actions">
          <button type="button" onClick={onSend} disabled={disabled || !value.trim()} className="composer-send">
            {disabled ? t("composer.sending") : t("composer.send")}
          </button>
          <label className="research-toggle">
            <input type="checkbox" checked={researchMode} onChange={(e) => onResearchModeChange(e.target.checked)} />
            {t("composer.researchMode")}
          </label>
          <span className="composer-hint">⌘↵ para enviar</span>
        </div>
      </div>
    </div>
  );
}
