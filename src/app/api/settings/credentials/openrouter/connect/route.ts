import { randomBytes, createHash } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth";

const verifierCookie = "or_pkce_verifier";

function codeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/", request.url));

  const verifier = randomBytes(32).toString("base64url");
  const callbackUrl = new URL("/api/settings/credentials/openrouter/callback", request.url).toString();

  const authorizeUrl = new URL("https://openrouter.ai/auth");
  authorizeUrl.searchParams.set("callback_url", callbackUrl);
  authorizeUrl.searchParams.set("code_challenge", codeChallenge(verifier));
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  const cookieStore = await cookies();
  cookieStore.set(verifierCookie, verifier, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/api/settings/credentials/openrouter" });

  return NextResponse.redirect(authorizeUrl);
}
