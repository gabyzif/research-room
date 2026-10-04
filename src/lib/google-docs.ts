import { google } from "googleapis";

import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";

type ExportInput = {
  userId: string;
  title: string;
  markdown: string;
  references: Array<{ apaCitation: string | null; url: string }>;
  existingDocumentId?: string;
  folderId?: string;
};

async function googleClient(userId: string) {
  const account = await prisma.oAuthAccount.findFirst({ where: { userId, provider: "google" } });
  if (!account || (!account.encryptedAccessToken && !account.encryptedRefreshToken)) {
    throw new Error("Google Docs no está conectado. Cerrá sesión y volvé a entrar con Google para autorizar el acceso.");
  }
  const client = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, `${process.env.NEXTAUTH_URL}/api/auth/callback/google`);
  client.setCredentials({
    access_token: account.encryptedAccessToken ? decryptSecret(account.encryptedAccessToken) : undefined,
    refresh_token: account.encryptedRefreshToken ? decryptSecret(account.encryptedRefreshToken) : undefined,
    expiry_date: account.expiresAt ? account.expiresAt * 1000 : undefined,
  });
  return client;
}

export async function getGoogleAccessToken(userId: string): Promise<string> {
  const client = await googleClient(userId);
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("No se pudo obtener un token de acceso de Google.");
  return token;
}

export function extractGoogleDocId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

type DocSegment = { text: string; namedStyle?: string };

function markdownToSegments(markdown: string, references: ExportInput["references"]): DocSegment[] {
  const segments: DocSegment[] = [];

  const HEADING_STYLE: Record<number, string> = {
    1: "HEADING_1",
    2: "HEADING_2",
    3: "HEADING_3",
    4: "HEADING_4",
    5: "HEADING_5",
    6: "HEADING_6",
  };

  for (const line of markdown.split("\n")) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 6);
      segments.push({ text: headingMatch[2] + "\n", namedStyle: HEADING_STYLE[level] });
      continue;
    }
    // Strip inline markdown for plain text lines (bold, italic, links)
    const plain = line
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")
      .replace(/^[-*]\s+/, "• ");
    segments.push({ text: (plain || "") + "\n" });
  }

  if (references.length > 0) {
    segments.push({ text: "\n" });
    segments.push({ text: "Referencias\n", namedStyle: "HEADING_2" });
    for (const ref of references) {
      segments.push({ text: (ref.apaCitation ?? ref.url) + "\n" });
    }
  }

  return segments;
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

function runsToMarkdown(elements: Array<{ textRun?: { content?: string | null; textStyle?: { bold?: boolean | null; italic?: boolean | null; link?: { url?: string | null } | null } | null } | null }>): string {
  return elements.map((el) => {
    const run = el.textRun;
    if (!run?.content) return "";
    let text = run.content.replace(/\n$/, "");
    const style = run.textStyle ?? {};
    if (style.link?.url) text = `[${text}](${style.link.url})`;
    if (style.bold && style.italic) text = `***${text}***`;
    else if (style.bold) text = `**${text}**`;
    else if (style.italic) text = `*${text}*`;
    return text;
  }).join("");
}

export async function importGoogleDocMarkdown(userId: string, documentId: string): Promise<string> {
  const docs = google.docs({ version: "v1", auth: await googleClient(userId) });
  const { data } = await docs.documents.get({ documentId });
  const content = data.body?.content ?? [];
  const lines: string[] = [];

  for (const element of content) {
    if (!element.paragraph) continue;
    const elements = element.paragraph.elements ?? [];
    const rawText = elements.map((el) => el.textRun?.content ?? "").join("");
    if (!rawText.replace(/\n/, "").trim()) { lines.push(""); continue; }

    const prefix = namedStyleToMarkdownPrefix(element.paragraph.paragraphStyle?.namedStyleType);
    const bulletProps = element.paragraph.bullet;
    const inlineText = runsToMarkdown(elements);

    if (prefix) {
      lines.push(`${prefix}${inlineText}`);
    } else if (bulletProps) {
      const nestingLevel = bulletProps.nestingLevel ?? 0;
      lines.push(`${"  ".repeat(nestingLevel)}- ${inlineText}`);
    } else {
      lines.push(inlineText);
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function createResearchGoogleDoc(input: ExportInput): Promise<{ documentId: string; url: string }> {
  const auth = await googleClient(input.userId);
  const docs = google.docs({ version: "v1", auth });

  let documentId = input.existingDocumentId ?? null;
  let createdNow = false;

  if (documentId) {
    // Clear existing content before re-exporting
    const existing = await docs.documents.get({ documentId });
    const bodyContent = existing.data.body?.content ?? [];
    const lastElement = bodyContent[bodyContent.length - 1];
    const endIndex = lastElement?.endIndex ?? 1;
    if (endIndex > 2) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [{ deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } } }],
        },
      });
    }
  } else {
    const created = await docs.documents.create({ requestBody: { title: `Investigación — ${input.title}` } });
    documentId = created.data.documentId!;
    createdNow = true;
  }

  // Move the doc into the chosen Drive folder (only on first creation — don't yank a re-export out of where the user filed it)
  if (input.folderId && createdNow) {
    const drive = google.drive({ version: "v3", auth });
    const meta = await drive.files.get({ fileId: documentId, fields: "parents" });
    const previousParents = (meta.data.parents ?? []).join(",");
    await drive.files.update({
      fileId: documentId,
      addParents: input.folderId,
      removeParents: previousParents || undefined,
      fields: "id, parents",
    });
  }

  const segments = markdownToSegments(input.markdown, input.references);
  const fullText = segments.map((s) => s.text).join("");

  // Track positions to apply heading styles after inserting text
  const styleRequests: Array<Record<string, unknown>> = [];
  let index = 1;
  for (const segment of segments) {
    const len = segment.text.length;
    if (segment.namedStyle) {
      styleRequests.push({
        updateParagraphStyle: {
          range: { startIndex: index, endIndex: index + len },
          paragraphStyle: { namedStyleType: segment.namedStyle },
          fields: "namedStyleType",
        },
      });
    }
    index += len;
  }

  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        { insertText: { location: { index: 1 }, text: fullText } },
        ...styleRequests,
      ],
    },
  });

  return { documentId, url: `https://docs.google.com/document/d/${documentId}/edit` };
}
