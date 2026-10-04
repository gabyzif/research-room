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
    ...(input.peerResponses && input.peerResponses.length > 0
      ? ["Si en tu respuesta llegás a una conclusión o síntesis respaldada por fuentes, proponé agregarla al documento. Si solo acordás sin agregar nada nuevo, usá proposal:null."]
      : ["Este es tu turno inicial — todavía no sabés qué va a responder tu compañero/a. NO propongas cambios al documento en este turno (usá siempre proposal:null). Tu propuesta, si corresponde, vendrá en el turno de discusión después de escuchar al otro. IMPORTANTE: si el mensaje del usuario es una confirmación corta ('sí', 'dale', 'sumalo', 'ok', 'hacelo', etc.), significa que está aprobando algo que otro compañero propuso en el historial — respondé brevemente reconociendo eso, sin confundirte con algún 'Documento X' mencionado en el chat. No inventes qué propuesta era: tu compañero la retomará en el turno de discusión."]),
    "Devolvé JSON válido con esta forma exacta: {\"answer\":string,\"sourceIds\":string[],\"proposal\":object|null}.",
    "proposal debe tener operation (insert|replace|delete), targetHeadingId, markdown, citationSourceIds y baseRevision. Si no proponés cambios, usá null.",
    "IMPORTANTE sobre proposals: el campo markdown debe contener SOLO contenido real del documento — texto, datos, análisis, conclusiones. NUNCA metacomentarios sobre la conversación como 'nota: falta el Documento X', 'pendiente de completar', 'por definir con el cliente', ni explicaciones de por qué estás proponiendo algo. Si no tenés información suficiente para escribir contenido real, usá proposal:null y explicá en tu answer qué información necesitás.",
    `targetHeadingId TIENE que ser uno de los headings que ya existen en el documento (no podés inventar uno nuevo):\n${headingContext(input.documentMarkdown)}`,
    "Para agregar una sección nueva (ej. \"## Requisitos sanitarios\"), usá operation:\"insert\" apuntando a un heading existente (el raíz sirve), y escribí el nuevo encabezado como parte del markdown que insertás — por ejemplo, markdown: \"## Requisitos sanitarios\\n\\nTexto...\". El heading nuevo pasa a estar disponible como targetHeadingId recién en el próximo turno, una vez que la propuesta se acepte.",
    ...(input.researchMode ? ["Tenés acceso a búsqueda web en tiempo real para este turno — usala para encontrar fuentes reales y citables. No hace falta que completes sourceIds vos mismo con URLs: el sistema registra automáticamente las fuentes que uses durante la búsqueda y las cita por vos. Dejá sourceIds como array vacío."] : []),
    `Modelos permitidos en este proyecto: ${allowedModels}.`,
    `Revisión vigente del documento: ${input.baseRevision ?? 0}.`,
    ...(input.instructions?.trim() ? [`Instrucciones específicas de este proyecto (seguilas siempre que no contradigan las reglas anteriores):\n${input.instructions.trim()}`] : []),
    ...(input.peerResponses && input.peerResponses.length > 0 ? [
      [
        "TURNO DE DISCUSIÓN",
        "Tu compañero/a ya respondió. Su respuesta:",
        ...input.peerResponses.map((peer) => {
          const snippet = peer.content.length > 800 ? peer.content.slice(0, 800) + "…" : peer.content;
          return `---\n${snippet}\n---`;
        }),
        "Tu tarea:",
        "0. CONFIRMACIONES DEL USUARIO: Si el último mensaje del usuario es una confirmación corta ('sí', 'dale', 'sumalo', 'de acuerdo', 'sí sumalo', 'hacelo', 'ok', 'agregalo', etc.), significa que está aprobando algo que se propuso en el historial de chat. Buscá en el historial qué propuesta concreta estaba pendiente, escribila como proposal en este turno, y confirmá brevemente en tu answer que la estás agregando. No pidas permiso de nuevo.",
        "1. NO uses ningún nombre propio de persona para dirigirte a tu compañero/a. Cualquier nombre que aparezca en la respuesta de arriba es un nombre del TEMA que están discutiendo, no el nombre de tu compañero. Dirigite a tu compañero/a sin nombrarlo: empezá con 'Acordamos en que...', 'Difiero en que...', 'Para agregar a lo que dijiste...' o similar.",
        "2. Identificá UNA idea específica de su respuesta y decí si acordás, diferís, o complementás.",
        "3. NO repitas ni resumas tu respuesta anterior.",
        "4. Sé breve: 2 o 3 párrafos.",
        "5. Si llegaste a una conclusión o síntesis concreta para el documento, incluí la proposal directamente. La tarjeta de propuesta le da al usuario el control para aceptarla o rechazarla — no hace falta que pidas permiso en el texto.",
        "6. Si acordás completamente sin nada nuevo que agregar, decilo en una oración y usá proposal:null.",
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
