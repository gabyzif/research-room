"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { type ProviderId } from "@/components/api-credentials-settings";
import { modelCatalog } from "@/lib/models/catalog";
import { type CompanionConfig } from "@/lib/models/types";
import { type DynamicModel } from "@/components/model-workbench";

const PERSONALITY_PRESETS = [
  { label: "— Elegir plantilla —", value: null },
  { label: "🔍 Crítico analítico", value: "Cuestionás cada afirmación, buscás contraejemplos y señalás inconsistencias. Tu objetivo es fortalecer el argumento encontrando sus puntos débiles antes de aceptarlo." },
  { label: "🚀 Optimista pragmático", value: "Orientado a la acción: buscás oportunidades concretas, casos de uso reales y pasos accionables. Priorizás lo que se puede implementar ahora sobre lo teórico." },
  { label: "📚 Académico riguroso", value: "Priorizás fuentes verificables, metodología sólida y precisión conceptual. Señalás cuándo algo carece de evidencia y proponés citas o estudios relevantes." },
  { label: "😈 Abogado del diablo", value: "Siempre presentás la perspectiva opuesta para que el equipo la considere. No es desacuerdo personal, es asegurar que ningún ángulo quede sin explorar." },
  { label: "🤝 Sintetizador", value: "Buscás puntos en común entre perspectivas distintas. Tu rol es encontrar la síntesis que integre las mejores ideas y proponer conclusiones que el equipo pueda compartir." },
  { label: "🔬 Especialista técnico", value: "Enfocado en detalles técnicos, precisión y rigor. Corregís imprecisiones, señalás matices importantes y aportás profundidad técnica al análisis." },
  { label: "🎨 Pensador creativo", value: "Buscás soluciones no convencionales y conexiones inesperadas entre ideas. Priorizás la originalidad y desafiás los enfoques más obvios o tradicionales." },
];

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  "meta-llama": "Meta",
  deepseek: "DeepSeek",
  mistralai: "Mistral",
  qwen: "Qwen · Alibaba",
  microsoft: "Microsoft",
  nvidia: "NVIDIA",
  cohere: "Cohere",
  "x-ai": "xAI",
  amazon: "Amazon",
  "z-ai": "Z.ai",
  xiaomi: "Xiaomi",
  tencent: "Tencent",
  upstage: "Upstage",
  stealth: "Stealth",
};

function providerOf(modelId: string) {
  return modelId.split("/")[0] ?? modelId;
}

function providerLabel(modelId: string) {
  const p = providerOf(modelId);
  return PROVIDER_LABELS[p] ?? p;
}

function groupByProvider(models: DynamicModel[]): Array<{ provider: string; label: string; models: DynamicModel[] }> {
  const map = new Map<string, DynamicModel[]>();
  for (const m of models) {
    const p = providerOf(m.modelId);
    if (!map.has(p)) map.set(p, []);
    map.get(p)!.push(m);
  }
  return Array.from(map.entries()).map(([provider, models]) => ({
    provider,
    label: PROVIDER_LABELS[provider] ?? provider,
    models,
  }));
}

function stripProviderPrefix(label: string): string {
  const idx = label.indexOf(": ");
  return idx > 0 ? label.slice(idx + 2) : label;
}

function modelLabel(modelId: string, dynamicModels: DynamicModel[]): string {
  const dyn = dynamicModels.find((m) => m.modelId === modelId);
  if (dyn) return dyn.label;
  const stat = modelCatalog.find((m) => m.modelId === modelId);
  if (stat) return stat.label;
  return modelId;
}

type StaticOption = { modelId: string; label: string; provider: string; costLabel?: string };

function ModelOption({ m, value, pick, showCost, showFree, stripPrefix }: {
  m: DynamicModel;
  value: string;
  pick: (id: string) => void;
  showCost?: boolean;
  showFree?: boolean;
  stripPrefix?: boolean;
}) {
  const label = stripPrefix ? stripProviderPrefix(m.label) : m.label;
  return (
    <button
      type="button"
      role="option"
      aria-selected={m.modelId === value}
      className={`ms-option${m.modelId === value ? " ms-option-selected" : ""}`}
      onClick={() => pick(m.modelId)}
    >
      <span className="ms-option-name" title={label}>{label}</span>
      {showFree && <span className="ms-option-free">Gratis</span>}
      {showCost && !m.isFree && <span className="ms-option-cost">{m.costLabel}</span>}
    </button>
  );
}

function ModelSelectDropdown({ value, onChange, nonOpenRouterOptions, freeModels, paidModels, dynamicModels }: {
  value: string;
  onChange: (v: string) => void;
  nonOpenRouterOptions: StaticOption[];
  freeModels: DynamicModel[];
  paidModels: DynamicModel[];
  dynamicModels: DynamicModel[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState({ top: 0, left: 0, width: 300 });
  const rootRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const updatePos = useCallback(() => {
    if (!rootRef.current) return;
    const r = rootRef.current.getBoundingClientRect();
    const margin = 8;
    const viewportWidth = window.innerWidth;
    const width = Math.min(Math.max(300, r.width), viewportWidth - margin * 2);
    const maxLeft = viewportWidth - width - margin;
    const left = Math.max(margin, Math.min(r.left, maxLeft));
    setPos({ top: r.bottom + 6, left, width });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!rootRef.current?.contains(t) && !dropdownRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open, updatePos]);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 10);
  }, [open]);

  const q = search.toLowerCase().trim();
  const filteredOwn = nonOpenRouterOptions.filter((m) => !q || m.label.toLowerCase().includes(q) || providerLabel(m.modelId).toLowerCase().includes(q));
  const filteredFree = freeModels.filter((m) => !q || m.label.toLowerCase().includes(q) || providerLabel(m.modelId).toLowerCase().includes(q));
  const filteredPaid = paidModels.filter((m) => !q || m.label.toLowerCase().includes(q) || providerLabel(m.modelId).toLowerCase().includes(q) || m.costLabel.toLowerCase().includes(q));

  // Group paid models by provider; when searching, skip single-item providers into a flat section
  const paidGroups = groupByProvider(filteredPaid);

  const hasResults = filteredOwn.length > 0 || filteredFree.length > 0 || filteredPaid.length > 0;
  const currentLabel = modelLabel(value, dynamicModels);
  const pick = (id: string) => { onChange(id); setOpen(false); setSearch(""); };

  return (
    <div className="ms-root" ref={rootRef}>
      <button
        type="button"
        className="ms-trigger"
        onClick={() => { setOpen((v) => !v); if (!open) setSearch(""); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={currentLabel}
      >
        <span className="ms-trigger-label">{currentLabel}</span>
        <span className="ms-caret" aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>

      {mounted && open && createPortal(
        <div
          ref={dropdownRef}
          className="ms-dropdown"
          role="listbox"
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
        >
          <div className="ms-search-wrap">
            <span className="ms-search-icon" aria-hidden="true">⌕</span>
            <input
              ref={searchRef}
              className="ms-search"
              placeholder="Buscar modelo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); e.stopPropagation(); } }}
            />
            {search && (
              <button type="button" className="ms-search-clear" onClick={() => setSearch("")} aria-label="Limpiar">✕</button>
            )}
          </div>

          <div className="ms-list">
            {filteredOwn.length > 0 && (
              <div className="ms-group">
                <div className="ms-group-label">Con tus credenciales</div>
                {filteredOwn.map((m) => (
                  <button
                    key={m.modelId}
                    type="button"
                    role="option"
                    aria-selected={m.modelId === value}
                    className={`ms-option${m.modelId === value ? " ms-option-selected" : ""}`}
                    onClick={() => pick(m.modelId)}
                  >
                    <span className="ms-option-name" title={m.label}>{m.label}</span>
                  </button>
                ))}
              </div>
            )}

            {filteredFree.length > 0 && (
              <div className="ms-group">
                <div className="ms-group-label">OpenRouter — Gratis</div>
                {groupByProvider(filteredFree).map(({ provider, label, models }) => (
                  <div key={provider} className="ms-subgroup">
                    <div className="ms-subgroup-label">{label}</div>
                    {models.map((m) => <ModelOption key={m.modelId} m={m} value={value} pick={pick} showFree stripPrefix />)}
                  </div>
                ))}
              </div>
            )}

            {paidGroups.length > 0 && (
              <div className="ms-group">
                <div className="ms-group-label">OpenRouter — De pago</div>
                {paidGroups.map(({ provider, label, models }) => (
                  <div key={provider} className="ms-subgroup">
                    <div className="ms-subgroup-label">{label}</div>
                    {models.map((m) => <ModelOption key={m.modelId} m={m} value={value} pick={pick} showCost stripPrefix />)}
                  </div>
                ))}
              </div>
            )}

            {!hasResults && (
              <div className="ms-empty">Sin resultados para &ldquo;{search}&rdquo;</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export function CompanionChip({ modelId, index, companion, onCompanionChange, onChangeModel, connectedProviders, dynamicModels }: {
  modelId: string;
  index: number;
  companion: CompanionConfig;
  onCompanionChange: (c: CompanionConfig) => void;
  onChangeModel: (nextModelId: string) => void;
  connectedProviders: ProviderId[];
  dynamicModels: DynamicModel[];
}) {
  const [personalityOpen, setPersonalityOpen] = useState(false);

  const nonOpenRouterOptions = modelCatalog.filter((o) => o.provider !== "openrouter" && o.provider !== "copilot" && connectedProviders.includes(o.provider));
  const freeModels = dynamicModels.filter((m) => m.isFree);
  const paidModels = dynamicModels.filter((m) => !m.isFree);

  return (
    <div className="companion-chip">
      <span className="model-card-v2-emoji">{companion.emoji || "🤖"}</span>
      <input
        type="text"
        className="model-card-v2-name"
        value={companion.name}
        maxLength={40}
        onChange={(e) => onCompanionChange({ ...companion, name: e.target.value })}
        aria-label="Nombre del compañero"
        title={companion.name}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />

      <div className="companion-chip-model-desktop">
        <ModelSelectDropdown
          value={modelId}
          onChange={onChangeModel}
          nonOpenRouterOptions={nonOpenRouterOptions}
          freeModels={freeModels}
          paidModels={paidModels}
          dynamicModels={dynamicModels}
        />
      </div>

      <button
        type="button"
        className="companion-chip-personality-toggle"
        onClick={() => setPersonalityOpen((v) => !v)}
        aria-expanded={personalityOpen}
        aria-label={`Instrucciones para el compañero ${index + 1}`}
        title="Darle instrucciones o una personalidad a este compañero"
      >💡</button>

      {personalityOpen && (
        <div className="companion-chip-personality">
          <div className="companion-chip-personality-header">
            <span aria-hidden="true">💡</span>
            <div>
              <p className="companion-chip-personality-title">Instrucciones para este compañero</p>
              <p className="companion-chip-personality-hint">Se le suman a cada mensaje que le mandes en este chat — definí cómo querés que piense o qué perspectiva tome.</p>
            </div>
          </div>
          <div className="companion-chip-model-mobile">
            <ModelSelectDropdown
              value={modelId}
              onChange={onChangeModel}
              nonOpenRouterOptions={nonOpenRouterOptions}
              freeModels={freeModels}
              paidModels={paidModels}
              dynamicModels={dynamicModels}
            />
          </div>
          <select
            className="companion-chip-preset-select"
            value={PERSONALITY_PRESETS.find((p) => p.value === companion.personality)?.value ?? ""}
            onChange={(e) => {
              const preset = PERSONALITY_PRESETS.find((p) => p.value === e.target.value);
              if (preset?.value != null) onCompanionChange({ ...companion, personality: preset.value });
            }}
          >
            {PERSONALITY_PRESETS.map((p) => (
              <option key={p.label} value={p.value ?? ""}>{p.label}</option>
            ))}
          </select>
          <textarea
            className="model-card-v2-personality"
            value={companion.personality}
            rows={6}
            maxLength={500}
            placeholder="Personalidad o perspectiva de este compañero…"
            onChange={(e) => onCompanionChange({ ...companion, personality: e.target.value })}
            onBlur={() => onCompanionChange(companion)}
          />
        </div>
      )}
    </div>
  );
}
