import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isRecoverableDatabaseConnectionError } from "@/lib/db-errors";

const projectSchema = z.object({
  title: z.string().trim().min(1),
  brief: z.string().trim().min(1),
  selectedModelIds: z.array(z.string().trim().min(1)).length(2),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const projects = await prisma.project.findMany({ where: { ownerId: session.user.id }, orderBy: { updatedAt: "desc" } });
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const parsed = projectSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const project = await prisma.project.create({
      data: {
        ownerId: session.user.id,
        title: parsed.data.title,
        brief: parsed.data.brief,
        selectedModelIds: parsed.data.selectedModelIds,
        document: { create: { markdown: `# ${parsed.data.title}\n\n${parsed.data.brief}` } },
      },
    });
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (isRecoverableDatabaseConnectionError(error)) {
      return NextResponse.json({ code: "DATABASE_UNAVAILABLE" }, { status: 503 });
    }
    throw error;
  }
}
