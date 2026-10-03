import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { applyProposal } from "@/lib/documents/proposals";

const actionSchema = z.object({ action: z.enum(["accept", "reject"]) });

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string; proposalId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = actionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { projectId, proposalId } = await context.params;

  try {
    const proposal = await applyProposal({ projectId, proposalId, userId: session.user.id, action: parsed.data.action });
    return NextResponse.json(proposal);
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error && typeof error.status === "number" ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update proposal" }, { status });
  }
}
