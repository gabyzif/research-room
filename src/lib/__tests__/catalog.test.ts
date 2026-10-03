import { describe, expect, it } from "vitest";

import { modelCatalog, modelOption, modelsByProvider } from "../models/catalog";

describe("model catalog", () => {
  it("contains both providers with visible costs", () => {
    expect(modelsByProvider("openrouter").length).toBeGreaterThan(0);
    expect(modelsByProvider("copilot").length).toBeGreaterThan(0);
    expect(modelCatalog.some((option) => option.costLabel.includes("créditos"))).toBe(true);
  });

  it("keeps unknown ids usable without inventing a dollar cost", () => {
    const option = modelOption("custom/model");
    expect(option.modelId).toBe("custom/model");
    expect(option.inputCostPerMillion).toBeNull();
  });
});
