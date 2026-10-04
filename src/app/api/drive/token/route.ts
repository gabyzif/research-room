import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getGoogleAccessToken } from "@/lib/google-docs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const token = await getGoogleAccessToken(session.user.id);
    const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
    const appId = clientId.split("-")[0] || null;
    return NextResponse.json({
      token,
      appId,
      apiKey: process.env.GOOGLE_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_API_KEY ?? null,
    });
  } catch (error) {
    console.error("[drive/token]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Token error" }, { status: 422 });
  }
}
