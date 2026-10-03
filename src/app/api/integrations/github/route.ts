import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connection = await prisma.oAuthAccount.findFirst({
    where: { provider: "github", userId: session.user.id },
    select: { provider: true, scope: true, expiresAt: true, updatedAt: true },
  });

  return NextResponse.json({ connected: Boolean(connection), connection });
}
