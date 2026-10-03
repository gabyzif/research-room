import { ApiProvider } from "@prisma/client";

import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";

export type ApiProviderId = "openai" | "anthropic" | "openrouter";

const providerIdToEnum: Record<ApiProviderId, ApiProvider> = {
  openai: ApiProvider.OPENAI,
  anthropic: ApiProvider.ANTHROPIC,
  openrouter: ApiProvider.OPENROUTER,
};

export async function getUserApiKey(userId: string, provider: ApiProviderId): Promise<string | null> {
  const credential = await prisma.apiCredential.findUnique({
    where: { userId_provider: { userId, provider: providerIdToEnum[provider] } },
    select: { encryptedKey: true },
  });
  return credential ? decryptSecret(credential.encryptedKey) : null;
}

export async function setUserApiKey(userId: string, provider: ApiProviderId, apiKey: string): Promise<void> {
  const encryptedKey = encryptSecret(apiKey);
  await prisma.apiCredential.upsert({
    where: { userId_provider: { userId, provider: providerIdToEnum[provider] } },
    update: { encryptedKey },
    create: { userId, provider: providerIdToEnum[provider], encryptedKey },
  });
}

export async function deleteUserApiKey(userId: string, provider: ApiProviderId): Promise<void> {
  await prisma.apiCredential.deleteMany({ where: { userId, provider: providerIdToEnum[provider] } });
}

export async function listConnectedProviders(userId: string): Promise<ApiProviderId[]> {
  const credentials = await prisma.apiCredential.findMany({ where: { userId }, select: { provider: true } });
  const enumToProviderId: Record<ApiProvider, ApiProviderId> = { OPENAI: "openai", ANTHROPIC: "anthropic", OPENROUTER: "openrouter" };
  return credentials.map((credential) => enumToProviderId[credential.provider]);
}
