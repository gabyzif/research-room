import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createResearchGoogleDoc } from "@/lib/google-docs";
import { prisma } from "@/lib/db";

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { projectId } = await context.params;
  const body = await request.json().catch(() => ({}));
  const folderId = typeof body?.folderId === "string" && body.folderId ? body.folderId : undefined;
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: session.user.id }, include: { document: true, sources: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!project.document) return NextResponse.json({ error: "Document draft is empty" }, { status: 422 });

  try {
    // Reuse existing Google Doc if this project was already exported
    const existingRevision = await prisma.documentRevision.findFirst({
      where: { documentId: project.document.id, source: { startsWith: "GOOGLE_DOC_URL:" } },
      orderBy: { revision: "desc" },
    });
    const existingDocumentId = existingRevision?.source?.replace("GOOGLE_DOC_URL:", "").split("/d/")[1]?.split("/")[0] ?? undefined;

    const exported = await createResearchGoogleDoc({
      userId: session.user.id,
      title: project.title,
      markdown: project.document.markdown,
      references: project.sources.filter((source) => source.title && source.url).map((source) => ({ apaCitation: source.apaCitation, url: source.url })),
      existingDocumentId,
      folderId,
    });

    const latestRevision = await prisma.documentRevision.findFirst({ where: { documentId: project.document.id }, orderBy: { revision: "desc" } });
    if (latestRevision) await prisma.documentRevision.update({ where: { id: latestRevision.id }, data: { source: `GOOGLE_DOC_URL:${exported.url}` } });
    else await prisma.documentRevision.create({ data: { documentId: project.document.id, revision: project.document.revision, markdown: project.document.markdown, source: `GOOGLE_DOC_URL:${exported.url}` } });
    return NextResponse.json(exported);
  } catch (error) {
    console.error("[export]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Google Docs export failed" }, { status: 422 });
  }
}
