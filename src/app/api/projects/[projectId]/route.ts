import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const patchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  selectedModelIds: z.array(z.string().min(1)).min(1).max(2).refine((ids) => new Set(ids).size === ids.length, "Duplicate model ids").optional(),
  instructions: z.string().max(4000).optional(),
  companions: z.array(z.object({
    slot: z.number().int().min(0).max(1),
    name: z.string().max(40).default(""),
    personality: z.string().max(500).default(""),
    emoji: z.string().max(10).default(""),
  })).max(2).optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { projectId } = await context.params;

  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: session.user.id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.selectedModelIds ? { selectedModelIds: parsed.data.selectedModelIds } : {}),
      ...(parsed.data.instructions !== undefined ? { instructions: parsed.data.instructions } : {}),
      ...(parsed.data.companions !== undefined ? { companions: parsed.data.companions } : {}),
    },
  });

  return NextResponse.json({ id: updated.id, title: updated.title, selectedModelIds: updated.selectedModelIds, instructions: updated.instructions, companions: updated.companions ?? [] });
}

export async function DELETE(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { projectId } = await context.params;

  const project = await prisma.project.findFirst({ where: { id: projectId, ownerId: session.user.id } });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.project.delete({ where: { id: projectId } });
  return NextResponse.json({ ok: true });
}
