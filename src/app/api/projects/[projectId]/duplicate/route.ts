import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { projectId } = await context.params;

  const source = await prisma.project.findFirst({ where: { id: projectId, ownerId: session.user.id } });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const title = `${source.title} (copia)`;
  const copy = await prisma.project.create({
    data: {
      ownerId: session.user.id,
      title,
      brief: source.brief,
      instructions: source.instructions,
      companions: source.companions ?? [],
      selectedModelIds: source.selectedModelIds ?? [],
      document: { create: { markdown: `# ${title}\n\n${source.brief}` } },
    },
  });

  return NextResponse.json(copy, { status: 201 });
}
