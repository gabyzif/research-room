import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { deleteUserApiKey, listConnectedProviders, setUserApiKey } from "@/lib/models/credentials";

const providerSchema = z.enum(["openai", "anthropic", "openrouter"]);
const putSchema = z.object({ provider: providerSchema, apiKey: z.string().trim().min(1) });
const deleteSchema = z.object({ provider: providerSchema });

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const connected = await listConnectedProviders(session.user.id);
  return NextResponse.json({ connected });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = putSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  await setUserApiKey(session.user.id, parsed.data.provider, parsed.data.apiKey);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = deleteSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  await deleteUserApiKey(session.user.id, parsed.data.provider);
  return NextResponse.json({ ok: true });
}
