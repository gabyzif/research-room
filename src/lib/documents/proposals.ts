import { ProposalStatus } from "@prisma/client";

export class ProposalConflictError extends Error {
  status = 409;
}

export class ProposalValidationError extends Error {
  status = 422;
}

type Heading = { line: number; level: number; text: string; id: string };

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function headings(markdown: string): Heading[] {
  return markdown.split("\n").flatMap((line, lineNumber) => {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (!match) return [];
    return [{ line: lineNumber, level: match[1].length, text: match[2], id: slugify(match[2]) }];
  });
}

function findHeading(markdown: string, targetHeadingId: string): Heading | undefined {
  return headings(markdown).find((heading) => heading.id === targetHeadingId || heading.text === targetHeadingId);
}

function sectionEnd(markdownLines: string[], heading: Heading): number {
  for (const candidate of headings(markdownLines.join("\n"))) {
    if (candidate.line > heading.line && candidate.level <= heading.level) return candidate.line;
  }
  return markdownLines.length;
}

export function applyMarkdownOperation(args: {
  markdown: string;
  operation: "insert" | "replace" | "delete";
  targetHeadingId: string;
  content: string;
}): string {
  const lines = args.markdown.split("\n");
  const heading = findHeading(args.markdown, args.targetHeadingId);
  if (!heading) throw new ProposalValidationError(`Heading not found: ${args.targetHeadingId}`);
  const end = sectionEnd(lines, heading);
  const replacement = args.content.trim();

  if (args.operation === "insert") {
    lines.splice(heading.line + 1, 0, ...(replacement ? [replacement] : []));
  } else if (args.operation === "replace") {
    lines.splice(heading.line + 1, end - heading.line - 1, ...(replacement ? [replacement] : []));
  } else {
    lines.splice(heading.line, end - heading.line);
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function applyProposal(args: {
  projectId: string;
  proposalId: string;
  userId: string;
  action: "accept" | "reject";
}) {
  const { prisma } = await import("../db");
  const proposal = await prisma.documentProposal.findUnique({
    where: { id: args.proposalId },
    include: { project: { include: { document: true, sources: { select: { id: true } } } } },
  });
  if (!proposal || proposal.projectId !== args.projectId || proposal.project.ownerId !== args.userId) {
    throw new ProposalValidationError("Proposal not found");
  }
  if (proposal.status !== ProposalStatus.PENDING) throw new ProposalValidationError("Proposal is already reviewed");

  if (args.action === "reject") {
    return prisma.documentProposal.update({ where: { id: proposal.id }, data: { status: ProposalStatus.REJECTED, reviewedAt: new Date() } });
  }

  const document = proposal.project.document;
  if (!document) throw new ProposalValidationError("Project has no document draft");
  if (document.revision !== proposal.baseRevision) {
    await prisma.documentProposal.update({ where: { id: proposal.id }, data: { status: ProposalStatus.CONFLICT, reviewedAt: new Date() } });
    throw new ProposalConflictError("Proposal is based on an outdated document revision");
  }

  const sourceIds = new Set(proposal.project.sources.map((source) => source.id));
  const citationSourceIds = Array.isArray(proposal.citationSourceIds) ? proposal.citationSourceIds : [];
  if (citationSourceIds.some((sourceId) => typeof sourceId !== "string" || !sourceIds.has(sourceId))) {
    throw new ProposalValidationError("Proposal contains an unknown citation source");
  }

  const operation = proposal.operation.toLowerCase() as "insert" | "replace" | "delete";
  const markdown = applyMarkdownOperation({
    markdown: document.markdown,
    operation,
    targetHeadingId: proposal.targetHeadingId,
    content: proposal.markdown,
  });
  const nextRevision = document.revision + 1;

  return prisma.$transaction(async (tx) => {
    await tx.documentDraft.update({ where: { id: document.id }, data: { markdown, revision: nextRevision } });
    await tx.documentRevision.create({
      data: { documentId: document.id, revision: nextRevision, markdown, source: "MODEL_PROPOSAL" },
    });
    return tx.documentProposal.update({ where: { id: proposal.id }, data: { status: ProposalStatus.ACCEPTED, reviewedAt: new Date() } });
  });
}
