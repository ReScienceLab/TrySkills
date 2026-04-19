import { describe, it, expect } from "vitest";

// Web Crypto API is available in Node 20+ / jsdom
// Test the core encrypt/decrypt roundtrip

describe("crypto", () => {
  // Stub Web Crypto if not available in test env
  const hasSubtle = typeof globalThis.crypto?.subtle !== "undefined";

  it.skipIf(!hasSubtle)("deriveKey returns a CryptoKey", async () => {
    const { deriveKey } = await import("@/lib/crypto");
    const key = await deriveKey("test-user-id");
    expect(key).toBeDefined();
    expect(key.type).toBe("secret");
  });

  it.skipIf(!hasSubtle)("encrypt and decrypt roundtrip", async () => {
    const { deriveKey, encrypt, decrypt } = await import("@/lib/crypto");
    const key = await deriveKey("test-user-id");
    const plaintext = JSON.stringify({
      providerId: "openrouter",
      model: "gpt-4o",
      llmKey: "FAKE_LLM_KEY_FOR_TEST",
      sandboxKey: "FAKE_SANDBOX_KEY_FOR_TEST",
    });

    const { ciphertext, iv } = await encrypt(plaintext, key);
    expect(ciphertext).toBeTruthy();
    expect(iv).toBeTruthy();
    expect(ciphertext).not.toBe(plaintext);

    const decrypted = await decrypt(ciphertext, iv, key);
    expect(decrypted).toBe(plaintext);
    expect(JSON.parse(decrypted)).toEqual({
      providerId: "openrouter",
      model: "gpt-4o",
      llmKey: "FAKE_LLM_KEY_FOR_TEST",
      sandboxKey: "FAKE_SANDBOX_KEY_FOR_TEST",
    });
  });

  it.skipIf(!hasSubtle)("different users produce different ciphertexts", async () => {
    const { deriveKey, encrypt } = await import("@/lib/crypto");
    const key1 = await deriveKey("user-a");
    const key2 = await deriveKey("user-b");
    const plaintext = "secret-data";

    const enc1 = await encrypt(plaintext, key1);
    const enc2 = await encrypt(plaintext, key2);

    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
  });

  it.skipIf(!hasSubtle)("wrong key fails to decrypt", async () => {
    const { deriveKey, encrypt, decrypt } = await import("@/lib/crypto");
    const key1 = await deriveKey("user-a");
    const key2 = await deriveKey("user-b");

    const { ciphertext, iv } = await encrypt("secret", key1);

    await expect(decrypt(ciphertext, iv, key2)).rejects.toThrow();
  });
});
