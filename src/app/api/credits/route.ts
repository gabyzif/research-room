import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getUserApiKey } from "@/lib/models/credentials";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = await getUserApiKey(session.user.id, "openrouter");
  if (!apiKey) return NextResponse.json({ connected: false });

  try {
    const response = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ connected: true, error: true });

    const payload = (await response.json()) as { data?: { total_credits?: number; total_usage?: number } };
    const totalCredits = payload.data?.total_credits ?? 0;
    const totalUsage = payload.data?.total_usage ?? 0;
    return NextResponse.json({ connected: true, totalCredits, totalUsage, remaining: totalCredits - totalUsage });
  } catch {
    return NextResponse.json({ connected: true, error: true });
  }
}
