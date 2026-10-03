import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { setUserApiKey } from "@/lib/models/credentials";

const verifierCookie = "or_pkce_verifier";

export async function GET(request: Request) {
  const session = await auth();
  const redirectTo = new URL("/", request.url);
  if (!session?.user?.id) return NextResponse.redirect(redirectTo);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const cookieStore = await cookies();
  const verifier = cookieStore.get(verifierCookie)?.value;
  cookieStore.delete(verifierCookie);

  if (!code || !verifier) {
    console.error("[OpenRouter callback] Missing:", { code: !!code, verifier: !!verifier });
    redirectTo.searchParams.set("openrouter", "error");
    return NextResponse.redirect(redirectTo);
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/auth/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: "S256" }),
    });
    if (!response.ok) throw new Error(`OpenRouter token exchange failed: ${response.status}`);
    const payload = (await response.json()) as { key?: string };
    if (!payload.key) throw new Error("OpenRouter did not return an API key");

    await setUserApiKey(session.user.id, "openrouter", payload.key);
    redirectTo.searchParams.set("openrouter", "connected");
  } catch (err) {
    console.error("[OpenRouter callback]", err);
    redirectTo.searchParams.set("openrouter", "error");
  }

  return NextResponse.redirect(redirectTo);
}
