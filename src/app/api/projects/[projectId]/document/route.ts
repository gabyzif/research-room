import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const documentSchema = z.object({ markdown: z.string(), baseRevision: z.number().int().nonnegative().optional() });

async function ownedProject(projectId: string, userId: string) {
  return prisma.project.findFirst({ where: { id: projectId, ownerId: userId }, include: { document: true, sources: true } });
}

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { projectId } = await context.params;
  const project = await ownedProject(projectId, session.user.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ...(project.document ?? { markdown: "", revision: 0 }), sources: project.sources });
}

export async function PUT(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = documentSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { projectId } = await context.params;
  const project = await ownedProject(projectId, session.user.id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const currentRevision = project.document?.revision ?? 0;
  if (parsed.data.baseRevision !== undefined && parsed.data.baseRevision !== currentRevision) {
    return NextResponse.json({ error: "Document revision conflict", revision: currentRevision }, { status: 409 });
  }
  const nextRevision = currentRevision + 1;
  const document = await prisma.$transaction(async (tx) => {
    const draft = project.document
      ? await tx.documentDraft.update({ where: { id: project.document.id }, data: { markdown: parsed.data.markdown, revision: nextRevision } })
      : await tx.documentDraft.create({ data: { projectId, markdown: parsed.data.markdown, revision: nextRevision } });
    await tx.documentRevision.create({ data: { documentId: draft.id, revision: nextRevision, markdown: parsed.data.markdown, source: "USER_EDIT" } });
    return draft;
  });
  return NextResponse.json(document);
}
