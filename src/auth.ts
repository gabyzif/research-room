import NextAuth from "next-auth";
import type { DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { prisma } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";

const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const githubConfigured = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);

const providers = [
  googleConfigured
    ? Google({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        authorization: {
          params: {
            access_type: "offline",
            prompt: "consent",
            scope: "openid email profile https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file",
          },
        },
      })
    : null,
  githubConfigured
    ? GitHub({
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        authorization: {
          params: { scope: "read:user user:email" },
        },
      })
    : null,
].filter((provider): provider is NonNullable<typeof provider> => Boolean(provider));

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  providers,
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email || !account) return false;

      const databaseUser = await prisma.user.upsert({
        where: { email: user.email },
        update: { name: user.name, image: user.image },
        create: { email: user.email, name: user.name, image: user.image },
      });

      await prisma.oAuthAccount.upsert({
        where: {
          provider_providerAccountId: {
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          },
        },
        update: {
          userId: databaseUser.id,
          encryptedAccessToken: account.access_token ? encryptSecret(account.access_token) : undefined,
          encryptedRefreshToken: account.refresh_token ? encryptSecret(account.refresh_token) : undefined,
          expiresAt: account.expires_at,
          scope: account.scope,
        },
        create: {
          userId: databaseUser.id,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          encryptedAccessToken: account.access_token ? encryptSecret(account.access_token) : undefined,
          encryptedRefreshToken: account.refresh_token ? encryptSecret(account.refresh_token) : undefined,
          expiresAt: account.expires_at,
          scope: account.scope,
        },
      });

      user.id = databaseUser.id;
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) session.user.id = String(token.userId);
      return session;
    },
  },
});

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
