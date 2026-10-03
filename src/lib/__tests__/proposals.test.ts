import { describe, expect, it } from "vitest";

import { ProposalValidationError, applyMarkdownOperation } from "../documents/proposals";

const markdown = "# Intro\n\nTexto inicial.\n\n## Método\n\nDetalles.";

describe("document proposals", () => {
  it("inserts under a heading", () => {
    expect(applyMarkdownOperation({ markdown, operation: "insert", targetHeadingId: "intro", content: "Nueva evidencia." })).toContain("Nueva evidencia.");
  });

  it("replaces a section and deletes a section", () => {
    const replaced = applyMarkdownOperation({ markdown, operation: "replace", targetHeadingId: "metodo", content: "Otro método." });
    expect(replaced).toContain("Otro método.");
    expect(applyMarkdownOperation({ markdown: replaced, operation: "delete", targetHeadingId: "metodo", content: "" })).not.toContain("## Método");
  });

  it("rejects an unknown heading", () => {
    expect(() => applyMarkdownOperation({ markdown, operation: "insert", targetHeadingId: "missing", content: "x" })).toThrow(ProposalValidationError);
  });
});
