"use client";
import { useTranslations } from "@/components/language-provider";

export function ModelComposer({ researchMode, value, onChange, onResearchModeChange, onSend, onStop, disabled }: { researchMode: boolean; value: string; onChange: (value: string) => void; onResearchModeChange: (value: boolean) => void; onSend: () => void; onStop?: () => void; disabled: boolean }) {
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
          {disabled ? (
            <button type="button" onClick={() => onStop?.()} className="composer-stop" aria-label="Detener respuesta">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="10" height="10" rx="2" /></svg>
              Detener
            </button>
          ) : (
            <button type="button" onClick={() => onSend()} disabled={!value.trim()} className="composer-send">
              {t("composer.send")}
            </button>
          )}
          <label className="research-toggle">
            <input type="checkbox" checked={researchMode} onChange={(e) => onResearchModeChange(e.target.checked)} disabled={disabled} />
            {t("composer.researchMode")}
          </label>
          <span className="composer-hint">⌘↵ para enviar</span>
        </div>
      </div>
    </div>
  );
}
