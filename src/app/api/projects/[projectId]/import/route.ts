import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { extractGoogleDocId, importGoogleDocMarkdown } from "@/lib/google-docs";
import { prisma } from "@/lib/db";

const importSchema = z.object({ googleDocUrl: z.string().trim().min(1) });

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = importSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { projectId } = await context.params;

  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: session.user.id }, include: { document: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const googleDocId = extractGoogleDocId(parsed.data.googleDocUrl);
  if (!googleDocId) return NextResponse.json({ error: "No pudimos leer el link de Google Docs" }, { status: 400 });

  try {
    const markdown = await importGoogleDocMarkdown(session.user.id, googleDocId);
    const currentRevision = project.document?.revision ?? 0;
    const nextRevision = currentRevision + 1;
    const document = await prisma.$transaction(async (tx) => {
      const draft = project.document
        ? await tx.documentDraft.update({ where: { id: project.document.id }, data: { markdown, revision: nextRevision } })
        : await tx.documentDraft.create({ data: { projectId, markdown, revision: nextRevision } });
      await tx.documentRevision.create({ data: { documentId: draft.id, revision: nextRevision, markdown, source: `GOOGLE_DOC_IMPORT:${googleDocId}` } });
      return draft;
    });
    return NextResponse.json(document);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Google Docs import failed" }, { status: 422 });
  }
}
