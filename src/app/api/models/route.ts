import { NextResponse } from "next/server";

export const revalidate = 3600;

type OpenRouterModel = {
  id: string;
  name: string;
  pricing: { prompt: string; completion: string };
  context_length: number;
  architecture?: { output_modalities?: string[]; input_modalities?: string[]; modality?: string };
  description?: string;
};

export async function GET() {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { "HTTP-Referer": process.env.NEXTAUTH_URL ?? "https://localhost:3000", "X-Title": "Research Room" },
      next: { revalidate: 3600 },
    });
    if (!response.ok) return NextResponse.json({ models: [] });

    const data = await response.json() as { data: OpenRouterModel[] };

    // Keep only text-output models, limit to top 40 by popularity before splitting free/paid
    const KNOWN_PROVIDERS = new Set(["openai", "anthropic", "google", "meta-llama", "deepseek", "mistralai", "qwen", "microsoft", "nvidia", "cohere", "x-ai", "amazon", "stealth", "z-ai", "xiaomi", "tencent", "upstage"]);

    const textModels = data.data.filter((m) => {
      const out = m.architecture?.output_modalities ?? m.architecture?.modality?.split("->")[1]?.split("+") ?? ["text"];
      const isText = out.some((o) => o.trim() === "text");
      const provider = m.id.split("/")[0];
      return isText && KNOWN_PROVIDERS.has(provider ?? "");
    });

    const freeOnes = textModels.filter((m) => parseFloat(m.pricing.prompt) === 0 && parseFloat(m.pricing.completion) === 0).slice(0, 8);
    const paidOnes = textModels.filter((m) => parseFloat(m.pricing.prompt) > 0 || parseFloat(m.pricing.completion) > 0).slice(0, 25);

    const models = [...freeOnes, ...paidOnes].map((m) => {
        const inputCost = parseFloat(m.pricing.prompt) * 1_000_000;
        const outputCost = parseFloat(m.pricing.completion) * 1_000_000;
        const isFree = inputCost === 0 && outputCost === 0;
        const fmt = (n: number) => n < 1 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`;
        const costLabel = isFree ? "Gratis" : `${fmt(inputCost)} · ${fmt(outputCost)} /1M`;
        return {
          modelId: m.id,
          label: m.name,
          contextLength: m.context_length,
          inputCostPerMillion: isFree ? 0 : inputCost,
          outputCostPerMillion: isFree ? 0 : outputCost,
          costLabel,
          isFree,
        };
      });

    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({ models: [] });
  }
}
