import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { runGroupChat } from "@/lib/research/model-chat";
import { MessageAuthorType } from "@prisma/client";

const messageSchema = z.object({
  content: z.string().trim().min(1),
  recipientModelIds: z.array(z.string().min(1)).min(1).max(3),
  researchMode: z.boolean().default(true),
});

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { projectId } = await context.params;

  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: session.user.id }, select: { id: true, selectedModelIds: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const modelIds = Array.isArray(project.selectedModelIds) ? project.selectedModelIds.filter((v): v is string => typeof v === "string") : [];
  const chatMessages = await prisma.chatMessage.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });

  const byModel: Record<string, Array<{ role: "user" | "assistant"; content: string }>> = {};
  for (const modelId of modelIds) byModel[modelId] = [];

  for (const msg of chatMessages) {
    const recipientIds = Array.isArray(msg.recipientModelIds) ? msg.recipientModelIds.filter((v): v is string => typeof v === "string") : [];
    if (msg.authorType === MessageAuthorType.USER) {
      for (const modelId of recipientIds) {
        if (byModel[modelId]) byModel[modelId].push({ role: "user", content: msg.content });
      }
    } else if (msg.authorType === MessageAuthorType.MODEL && msg.modelId && byModel[msg.modelId]) {
      byModel[msg.modelId].push({ role: "assistant", content: msg.content });
    }
  }

  return NextResponse.json({ messages: byModel });
}

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = messageSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { projectId } = await context.params;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const write = (event: string, data: Record<string, unknown>) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        const events = runGroupChat({ projectId, userId: session.user.id, ...parsed.data });
        for await (const event of events) write(event.event, event.data);
      } catch (error) {
        write("failed", { error: error instanceof Error ? error.message : "Unable to process message" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
}
