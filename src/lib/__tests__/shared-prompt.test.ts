import { describe, expect, it } from "vitest";

import { parseModelContent, systemPrompt } from "../models/shared-prompt";
import type { ModelRunInput } from "../models/types";

const baseInput: ModelRunInput = { modelId: "test-model", messages: [], documentMarkdown: "", sources: [{ id: "s1", title: "Source", url: "https://example.com" }] };

const structured = { answer: "La respuesta.", sourceIds: ["s1"], proposal: null };

describe("parseModelContent", () => {
  it("parses raw JSON with no fence", () => {
    const result = parseModelContent(JSON.stringify(structured), baseInput);
    expect(result.content).toBe("La respuesta.");
    expect(result.sourceIds).toEqual(["s1"]);
  });

  it("parses JSON wrapped in a ```json fence", () => {
    const content = "```json\n" + JSON.stringify(structured) + "\n```";
    const result = parseModelContent(content, baseInput);
    expect(result.content).toBe("La respuesta.");
    expect(result.sourceIds).toEqual(["s1"]);
  });

  it("parses JSON wrapped in a plain ``` fence", () => {
    const content = "```\n" + JSON.stringify(structured) + "\n```";
    const result = parseModelContent(content, baseInput);
    expect(result.content).toBe("La respuesta.");
  });

  it("falls back to the raw string when there is no JSON at all", () => {
    const result = parseModelContent("Esto no es JSON.", baseInput);
    expect(result.content).toBe("Esto no es JSON.");
    expect(result.sourceIds).toEqual([]);
    expect(result.proposal).toBeUndefined();
  });

  it("filters out sourceIds not present in the provided sources", () => {
    const result = parseModelContent(JSON.stringify({ answer: "x", sourceIds: ["s1", "unknown"], proposal: null }), baseInput);
    expect(result.sourceIds).toEqual(["s1"]);
  });
});

describe("systemPrompt", () => {
  it("includes TURNO DE DISCUSIÓN block when peerResponses is provided", () => {
    const input: ModelRunInput = { ...baseInput, peerResponses: [{ modelId: "gpt-4o-mini", content: "hola", proposal: undefined }] };
    const result = systemPrompt(input);
    expect(result).toContain("TURNO DE DISCUSIÓN");
    expect(result).toContain("gpt-4o-mini");
  });

  it("does not include TURNO DE DISCUSIÓN when peerResponses is absent", () => {
    const result = systemPrompt(baseInput);
    expect(result).not.toContain("TURNO DE DISCUSIÓN");
  });
});
