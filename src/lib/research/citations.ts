// citation-js ships without TypeScript declarations.
// @ts-expect-error The runtime API is stable and wrapped by formatApa below.
import Cite from "citation-js";

export type CitationSource = {
  title: string;
  url: string;
  authors?: Array<{ given?: string; family?: string }>;
  publishedAt?: string | Date | null;
  doi?: string | null;
};

export type CslJson = {
  id: string;
  type: "webpage" | "article-journal";
  title: string;
  URL: string;
  author?: Array<{ given?: string; family?: string }>;
  issued?: { "date-parts": number[][] };
  DOI?: string;
};

export function toCslJson(source: CitationSource): CslJson {
  const date = source.publishedAt ? new Date(source.publishedAt) : null;
  return {
    id: source.doi ?? source.url,
    type: source.doi ? "article-journal" : "webpage",
    title: source.title,
    URL: source.url,
    author: source.authors?.length ? source.authors : undefined,
    issued: date && !Number.isNaN(date.valueOf()) ? { "date-parts": [[date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]] } : undefined,
    DOI: source.doi ?? undefined,
  };
}

function manualApa(source: CitationSource): string {
  const authors = source.authors?.length
    ? `${source.authors.map((author) => `${author.family ?? ""}${author.given ? `, ${author.given[0]}.` : ""}`).join(", ")}. `
    : "";
  const year = source.publishedAt ? new Date(source.publishedAt).getUTCFullYear() : "n.d.";
  return `${authors}(${year}). ${source.title}. ${source.url}`;
}

export function formatApa(source: CitationSource): string {
  try {
    const formatted = new Cite([toCslJson(source)]).format("bibliography", {
      format: "text",
      template: "apa",
      lang: "en-US",
    });
    return String(formatted).trim();
  } catch {
    return manualApa(source);
  }
}
