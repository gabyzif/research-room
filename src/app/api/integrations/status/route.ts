import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await prisma.oAuthAccount.findMany({
    where: { userId: session.user.id },
    select: { provider: true, scope: true, expiresAt: true, updatedAt: true },
    orderBy: { provider: "asc" },
  });

  return NextResponse.json({ accounts });
}
