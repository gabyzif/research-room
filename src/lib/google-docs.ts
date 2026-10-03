import { google } from "googleapis";

import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";

type ExportInput = {
  userId: string;
  title: string;
  markdown: string;
  references: Array<{ apaCitation: string | null; url: string }>;
  documentId?: string;
};

function markdownToText(markdown: string, references: ExportInput["references"]): string {
  const body = markdown.replace(/^#{1,6}\s+/gm, "").replace(/\*\*(.*?)\*\*/g, "$1").replace(/\[(.*?)\]\((.*?)\)/g, "$1 ($2)");
  const bibliography = references.length ? `\n\nReferencias\n\n${references.map((reference) => reference.apaCitation ?? reference.url).join("\n")}` : "";
  return `${body}${bibliography}`;
}

async function googleClient(userId: string) {
  const account = await prisma.oAuthAccount.findFirst({ where: { userId, provider: "google" } });
  if (!account?.encryptedAccessToken) throw new Error("Google Docs no está conectado");
  const client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.NEXTAUTH_URL);
  client.setCredentials({
    access_token: decryptSecret(account.encryptedAccessToken),
    refresh_token: account.encryptedRefreshToken ? decryptSecret(account.encryptedRefreshToken) : undefined,
    expiry_date: account.expiresAt ? account.expiresAt * 1000 : undefined,
  });
  return client;
}

export function extractGoogleDocId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

function namedStyleToMarkdownPrefix(style?: string | null): string {
  switch (style) {
    case "TITLE":
    case "HEADING_1": return "# ";
    case "HEADING_2": return "## ";
    case "HEADING_3": return "### ";
    case "HEADING_4": return "#### ";
    case "HEADING_5": return "##### ";
    case "HEADING_6": return "###### ";
    default: return "";
  }
}

export async function importGoogleDocMarkdown(userId: string, documentId: string): Promise<string> {
  const docs = google.docs({ version: "v1", auth: await googleClient(userId) });
  const { data } = await docs.documents.get({ documentId });
  const content = data.body?.content ?? [];
  const lines: string[] = [];
  for (const element of content) {
    if (!element.paragraph) continue;
    const text = (element.paragraph.elements ?? []).map((run) => run.textRun?.content ?? "").join("").replace(/\n$/, "");
    if (!text.trim()) { lines.push(""); continue; }
    lines.push(`${namedStyleToMarkdownPrefix(element.paragraph.paragraphStyle?.namedStyleType)}${text}`);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function createResearchGoogleDoc(input: ExportInput): Promise<{ documentId: string; url: string }> {
  const docs = google.docs({ version: "v1", auth: await googleClient(input.userId) });
  const driveDocument = input.documentId
    ? { documentId: input.documentId }
    : await docs.documents.create({ requestBody: { title: `Investigación — ${input.title}` } }).then((response) => ({ documentId: response.data.documentId! }));
  const text = markdownToText(input.markdown, input.references);
  await docs.documents.batchUpdate({ documentId: driveDocument.documentId, requestBody: { requests: [{ insertText: { location: { index: 1 }, text } }] } });
  return { documentId: driveDocument.documentId, url: `https://docs.google.com/document/d/${driveDocument.documentId}/edit` };
}
