import { describe, expect, it } from "vitest";

import { formatApa, toCslJson } from "../research/citations";

describe("citations", () => {
  it("converts a source to CSL JSON", () => {
    const csl = toCslJson({ title: "A study", url: "https://example.com/a", publishedAt: "2024-01-02", authors: [{ family: "Doe", given: "Jane" }] });
    expect(csl.type).toBe("webpage");
    expect(csl.issued?.["date-parts"][0][0]).toBe(2024);
  });

  it("returns an APA-like bibliography entry with a URL", () => {
    const apa = formatApa({ title: "A study", url: "https://example.com/a", publishedAt: "2024-01-02", authors: [{ family: "Doe", given: "Jane" }] });
    expect(apa).toContain("A study");
    expect(apa).toContain("https://example.com/a");
  });
});
