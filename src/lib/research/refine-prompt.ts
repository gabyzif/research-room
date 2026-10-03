import OpenAI from "openai";

import { getUserApiKey } from "@/lib/models/credentials";

const REFINE_MODEL = "openai/gpt-4o-mini";
const REFINE_TIMEOUT_MS = 8000;

function openRouterClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    timeout: REFINE_TIMEOUT_MS,
    defaultHeaders: {
      "HTTP-Referer": process.env.NEXTAUTH_URL ?? "http://localhost:3000",
      "X-Title": "Research Room",
    },
  });
}

export async function refinePrompt(content: string, context: { projectTitle: string; projectBrief: string; userId?: string }): Promise<string> {
  try {
    const apiKey = (context.userId ? await getUserApiKey(context.userId, "openrouter") : null) ?? process.env.OPENROUTER_API_KEY;
    if (!apiKey) return content;
    const completion = await openRouterClient(apiKey).chat.completions.create({
      model: REFINE_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: [
            "Reformulá la pregunta del usuario para que sea clara, específica y fácil de responder por modelos de investigación.",
            "Mantené el idioma original y la intención exacta del usuario. No agregues información que no esté implícita en la pregunta ni la respondas.",
            "Devolvé únicamente la pregunta reformulada como texto plano, sin comillas, prefijos ni explicaciones.",
            `Proyecto: ${context.projectTitle}. Brief: ${context.projectBrief}`,
          ].join("\n"),
        },
        { role: "user", content },
      ],
    });
    const refined = completion.choices[0]?.message?.content?.trim();
    return refined && refined.length > 0 ? refined : content;
  } catch {
    return content;
  }
}
