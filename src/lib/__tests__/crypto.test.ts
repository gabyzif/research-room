import { beforeEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "../crypto";

describe("secret encryption", () => {
  beforeEach(() => {
    process.env.APP_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  it("round-trips a secret without returning plaintext", () => {
    const encrypted = encryptSecret("oauth-token");
    expect(encrypted).not.toContain("oauth-token");
    expect(decryptSecret(encrypted)).toBe("oauth-token");
  });

  it("rejects a missing key", () => {
    delete process.env.APP_ENCRYPTION_KEY;
    expect(() => encryptSecret("secret")).toThrow("APP_ENCRYPTION_KEY is required");
  });
});
