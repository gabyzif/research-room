import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createResearchGoogleDoc } from "@/lib/google-docs";
import { prisma } from "@/lib/db";

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { projectId } = await context.params;
  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: session.user.id }, include: { document: true, sources: true } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!project.document) return NextResponse.json({ error: "Document draft is empty" }, { status: 422 });

  try {
    const exported = await createResearchGoogleDoc({
      userId: session.user.id,
      title: project.title,
      markdown: project.document.markdown,
      references: project.sources.filter((source) => source.title && source.url).map((source) => ({ apaCitation: source.apaCitation, url: source.url })),
    });
    const latestRevision = await prisma.documentRevision.findFirst({ where: { documentId: project.document.id }, orderBy: { revision: "desc" } });
    if (latestRevision) await prisma.documentRevision.update({ where: { id: latestRevision.id }, data: { source: `GOOGLE_DOC_URL:${exported.url}` } });
    else await prisma.documentRevision.create({ data: { documentId: project.document.id, revision: project.document.revision, markdown: project.document.markdown, source: `GOOGLE_DOC_URL:${exported.url}` } });
    return NextResponse.json(exported);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Google Docs export failed" }, { status: 422 });
  }
}
