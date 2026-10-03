import { z } from "zod";

import { headings } from "@/lib/documents/proposals";
import type { ModelRunInput, ModelRunOutput } from "@/lib/models/types";

const proposalSchema = z
  .object({
    operation: z.enum(["insert", "replace", "delete"]),
    targetHeadingId: z.string().min(1),
    markdown: z.string(),
    citationSourceIds: z.array(z.string()).default([]),
    baseRevision: z.number().int().nonnegative().default(0),
  })
  .nullable()
  .optional();

const structuredAnswerSchema = z.object({
  answer: z.string(),
  sourceIds: z.array(z.string()).default([]),
  proposal: proposalSchema,
});

function sourceContext(sources: ModelRunInput["sources"]): string {
  if (sources.length === 0) return "No hay fuentes verificadas disponibles para este turno.";
  return sources
    .map((source) => `- ${source.id}: ${source.title} (${source.url})${source.apaCitation ? ` — APA: ${source.apaCitation}` : ""}`)
    .join("\n");
}

function headingContext(documentMarkdown: string): string {
  const available = headings(documentMarkdown);
  if (available.length === 0) return "El documento no tiene ningún heading todavía — no podés proponer cambios hasta que exista al menos un heading raíz.";
  return available.map((heading) => `- targetHeadingId "${heading.id}" → ${"#".repeat(heading.level)} ${heading.text}`).join("\n");
}

export function systemPrompt(input: ModelRunInput): string {
  const allowedModels = input.selectedModelIds?.join(", ") ?? input.modelId;
  return [
    ...(input.companionName ? [
      `Tu nombre en este equipo es "${input.companionName}".${input.companionPersonality?.trim() ? ` Tu perspectiva y forma de trabajar: ${input.companionPersonality.trim()}` : ""}`,
    ] : []),
    "Sos un integrante de un equipo de investigación. Respondé en español salvo que la persona pida otro idioma.",
    "No inventes fuentes ni citas. Solo podés citar los sourceIds incluidos en el contexto, o los que surjan de tu propia búsqueda web si tenés acceso a ella para este turno.",
    "Si tenés al menos una fuente citable (verificada o de tu propia búsqueda) que aporte información nueva y relevante, SIEMPRE proponé agregarla al documento — no esperes a tener el panorama completo del tema, una propuesta parcial con lo que sí tenés es mejor que ninguna. Usá proposal:null solo cuando no tengas ninguna fuente citable todavía, o cuando la respuesta no agregue nada nuevo al documento (ej: una aclaración, una pregunta de vuelta, o contenido ya cubierto).",
    "Devolvé JSON válido con esta forma exacta: {\"answer\":string,\"sourceIds\":string[],\"proposal\":object|null}.",
    "proposal debe tener operation (insert|replace|delete), targetHeadingId, markdown, citationSourceIds y baseRevision. Si no proponés cambios, usá null.",
    `targetHeadingId TIENE que ser uno de los headings que ya existen en el documento (no podés inventar uno nuevo):\n${headingContext(input.documentMarkdown)}`,
    "Para agregar una sección nueva (ej. \"## Requisitos sanitarios\"), usá operation:\"insert\" apuntando a un heading existente (el raíz sirve), y escribí el nuevo encabezado como parte del markdown que insertás — por ejemplo, markdown: \"## Requisitos sanitarios\\n\\nTexto...\". El heading nuevo pasa a estar disponible como targetHeadingId recién en el próximo turno, una vez que la propuesta se acepte.",
    ...(input.researchMode ? ["Tenés acceso a búsqueda web en tiempo real para este turno — usala para encontrar fuentes reales y citables. No hace falta que completes sourceIds vos mismo con URLs: el sistema registra automáticamente las fuentes que uses durante la búsqueda y las cita por vos. Dejá sourceIds como array vacío."] : []),
    `Modelos permitidos en este proyecto: ${allowedModels}.`,
    `Revisión vigente del documento: ${input.baseRevision ?? 0}.`,
    ...(input.instructions?.trim() ? [`Instrucciones específicas de este proyecto (seguilas siempre que no contradigan las reglas anteriores):\n${input.instructions.trim()}`] : []),
    ...(input.peerResponses && input.peerResponses.length > 0 ? [
      [
        "TURNO DE DISCUSIÓN — leé esto con atención.",
        "Tu compañero/a ya respondió. Lo que dijo (resumido a los puntos clave):",
        ...input.peerResponses.map((peer) => {
          const snippet = peer.content.length > 800 ? peer.content.slice(0, 800) + "…" : peer.content;
          return `— ${peer.modelId}:\n${snippet}`;
        }),
        "Tu tarea en este turno:",
        `1. Respondele DIRECTAMENTE a ${input.peerResponses.map((p) => p.modelId).join(", ")} por su nombre.`,
        "2. Empezá con: \"[nombre], [acordás/diferís/complementás] con vos en que...\" — en esas palabras o similares.",
        "3. Identificá UNA idea específica que dijo el otro y decís si acordás, diferís, o tenés algo que agregar.",
        "4. NO repitas tu respuesta anterior. No la resumas. No la parafrasees.",
        "5. Sé breve: 2 o 3 párrafos máximo.",
        "6. Si acordás completamente, decilo en una sola oración y usá proposal:null.",
        "7. Si tenés una corrección o complemento respaldado por una fuente concreta, proponélo.",
      ].join("\n"),
    ] : []),
    `Documento compartido actual:\n${input.documentMarkdown || "(vacío)"}`,
    `Fuentes verificadas:\n${sourceContext(input.sources)}`,
  ].join("\n\n");
}

function extractJsonPayload(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) return fenced[1];
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start >= 0 && end > start) return content.slice(start, end + 1);
  return content;
}

export function parseModelContent(content: string, input: ModelRunInput): Pick<ModelRunOutput, "content" | "sourceIds" | "proposal"> {
  const validSourceIds = new Set(input.sources.map((source) => source.id));
  const parsedJson = (() => {
    try {
      return structuredAnswerSchema.parse(JSON.parse(extractJsonPayload(content)));
    } catch {
      // Schema validation failed — try to salvage at least the answer field
      try {
        const raw = JSON.parse(extractJsonPayload(content)) as Record<string, unknown>;
        if (typeof raw.answer === "string") return { answer: raw.answer, sourceIds: [], proposal: null };
      } catch { /* not JSON at all — fall through */ }
      return null;
    }
  })();

  if (!parsedJson) return { content, sourceIds: [], proposal: undefined };

  const sourceIds = parsedJson.sourceIds.filter((sourceId) => validSourceIds.has(sourceId));
  const proposal = parsedJson.proposal
    ? {
        ...parsedJson.proposal,
        baseRevision: input.baseRevision ?? parsedJson.proposal.baseRevision,
        citationSourceIds: parsedJson.proposal.citationSourceIds.filter((sourceId) => validSourceIds.has(sourceId)),
      }
    : undefined;

  return { content: parsedJson.answer, sourceIds, proposal };
}

export async function recordUsage(args: { projectId?: string; messageId?: string; provider: string; modelId: string; inputTokens: number; outputTokens: number; costUsd: number | null; credits: number | null }): Promise<void> {
  if (!args.projectId) return;
  const { prisma } = await import("@/lib/db");
  await prisma.usageRecord.create({
    data: {
      projectId: args.projectId,
      messageId: args.messageId,
      provider: args.provider,
      modelId: args.modelId,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      costUsd: args.costUsd,
      credits: args.credits,
    },
  });
}
