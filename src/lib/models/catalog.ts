export type ModelProvider = "openrouter" | "copilot" | "openai" | "anthropic";

export type ModelOption = {
  provider: ModelProvider;
  modelId: string;
  label: string;
  shortLabel: string;
  inputCostPerMillion: number | null;
  outputCostPerMillion: number | null;
  costLabel: string;
};

export const modelCatalog: ModelOption[] = [
  { provider: "openrouter", modelId: "openai/gpt-4o-mini", label: "GPT-4o mini", shortLabel: "GPT-4o mini", inputCostPerMillion: 0.15, outputCostPerMillion: 0.6, costLabel: "$0.15 / $0.60 por 1M tokens" },
  { provider: "openrouter", modelId: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5", shortLabel: "Claude Sonnet 5", inputCostPerMillion: 2, outputCostPerMillion: 10, costLabel: "$2 / $10 por 1M tokens" },
  { provider: "openrouter", modelId: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash", shortLabel: "Gemini Flash", inputCostPerMillion: 0.75, outputCostPerMillion: 3.75, costLabel: "$0.75 / $3.75 por 1M tokens" },
  { provider: "copilot", modelId: "copilot:gpt-5-mini", label: "GPT-5 mini", shortLabel: "Copilot GPT-5 mini", inputCostPerMillion: null, outputCostPerMillion: null, costLabel: "Usa créditos Copilot" },
  { provider: "copilot", modelId: "copilot:claude-sonnet", label: "Claude Sonnet", shortLabel: "Copilot Claude", inputCostPerMillion: null, outputCostPerMillion: null, costLabel: "Usa créditos Copilot" },
  { provider: "copilot", modelId: "copilot:gemini-flash", label: "Gemini Flash", shortLabel: "Copilot Gemini", inputCostPerMillion: null, outputCostPerMillion: null, costLabel: "Usa créditos Copilot" },
  { provider: "openai", modelId: "openai-direct:gpt-4o-mini", label: "GPT-4o mini (usa tu cuenta)", shortLabel: "OpenAI GPT-4o mini", inputCostPerMillion: null, outputCostPerMillion: null, costLabel: "Usa tu propia API key de OpenAI" },
  { provider: "openai", modelId: "openai-direct:gpt-4o", label: "GPT-4o (usa tu cuenta)", shortLabel: "OpenAI GPT-4o", inputCostPerMillion: null, outputCostPerMillion: null, costLabel: "Usa tu propia API key de OpenAI" },
  { provider: "anthropic", modelId: "anthropic-direct:claude-sonnet-5", label: "Claude Sonnet 5 (usa tu cuenta)", shortLabel: "Claude Sonnet 5", inputCostPerMillion: null, outputCostPerMillion: null, costLabel: "Usa tu propia API key de Anthropic" },
];

function inferProvider(modelId: string): ModelProvider {
  if (modelId.startsWith("copilot:")) return "copilot";
  if (modelId.startsWith("openai-direct:")) return "openai";
  if (modelId.startsWith("anthropic-direct:")) return "anthropic";
  return "openrouter";
}

export function modelOption(modelId: string): ModelOption {
  return modelCatalog.find((option) => option.modelId === modelId) ?? {
    provider: inferProvider(modelId),
    modelId,
    label: modelId,
    shortLabel: modelId,
    inputCostPerMillion: null,
    outputCostPerMillion: null,
    costLabel: "Coste se informará por el proveedor",
  };
}

export function modelsByProvider(provider: ModelProvider): ModelOption[] {
  return modelCatalog.filter((option) => option.provider === provider);
}

const providerLabels: Record<ModelProvider, string> = { openrouter: "OpenRouter", copilot: "Copilot", openai: "OpenAI", anthropic: "Anthropic" };

export function modelOptionLabel(option: ModelOption): string {
  return `${providerLabels[option.provider]} · ${option.label}`;
}
