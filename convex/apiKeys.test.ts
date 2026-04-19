/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("apiKeys", () => {
  describe("save", () => {
    test("throws when not authenticated", async () => {
      const t = convexTest(schema, modules);
      await expect(
        t.mutation(api.apiKeys.save, {
          encryptedData: "enc-data",
          iv: "test-iv",
        }),
      ).rejects.toThrow("Not authenticated");
    });

    test("inserts a new key for authenticated user", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ name: "Alice" });

      await asUser.mutation(api.apiKeys.save, {
        encryptedData: "enc-data",
        iv: "test-iv",
      });

      const stored = await asUser.query(api.apiKeys.load);
      expect(stored).toMatchObject({
        encryptedData: "enc-data",
        iv: "test-iv",
      });
      expect(stored!.updatedAt).toBeTypeOf("number");
    });

    test("updates existing key on subsequent save", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ name: "Alice" });

      await asUser.mutation(api.apiKeys.save, {
        encryptedData: "first",
        iv: "iv-1",
      });

      await asUser.mutation(api.apiKeys.save, {
        encryptedData: "second",
        iv: "iv-2",
      });

      const stored = await asUser.query(api.apiKeys.load);
      expect(stored).toMatchObject({
        encryptedData: "second",
        iv: "iv-2",
      });
    });

    test("keys are isolated between users", async () => {
      const t = convexTest(schema, modules);
      const asAlice = t.withIdentity({ name: "Alice" });
      const asBob = t.withIdentity({ name: "Bob" });

      await asAlice.mutation(api.apiKeys.save, {
        encryptedData: "alice-data",
        iv: "alice-iv",
      });
      await asBob.mutation(api.apiKeys.save, {
        encryptedData: "bob-data",
        iv: "bob-iv",
      });

      const aliceKeys = await asAlice.query(api.apiKeys.load);
      const bobKeys = await asBob.query(api.apiKeys.load);

      expect(aliceKeys).toMatchObject({ encryptedData: "alice-data" });
      expect(bobKeys).toMatchObject({ encryptedData: "bob-data" });
    });
  });

  describe("load", () => {
    test("returns null when not authenticated", async () => {
      const t = convexTest(schema, modules);
      const result = await t.query(api.apiKeys.load);
      expect(result).toBeNull();
    });

    test("returns null when no keys stored", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ name: "Alice" });
      const result = await asUser.query(api.apiKeys.load);
      expect(result).toBeNull();
    });

    test("returns stored keys for authenticated user", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ name: "Alice" });

      await asUser.mutation(api.apiKeys.save, {
        encryptedData: "enc-data",
        iv: "test-iv",
      });

      const result = await asUser.query(api.apiKeys.load);
      expect(result).toMatchObject({
        encryptedData: "enc-data",
        iv: "test-iv",
        tokenIdentifier: expect.any(String),
        updatedAt: expect.any(Number),
      });
    });
  });

  describe("remove", () => {
    test("throws when not authenticated", async () => {
      const t = convexTest(schema, modules);
      await expect(t.mutation(api.apiKeys.remove)).rejects.toThrow(
        "Not authenticated",
      );
    });

    test("removes existing keys", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ name: "Alice" });

      await asUser.mutation(api.apiKeys.save, {
        encryptedData: "enc-data",
        iv: "test-iv",
      });

      await asUser.mutation(api.apiKeys.remove);

      const result = await asUser.query(api.apiKeys.load);
      expect(result).toBeNull();
    });

    test("succeeds even when no keys exist", async () => {
      const t = convexTest(schema, modules);
      const asUser = t.withIdentity({ name: "Alice" });
      await expect(asUser.mutation(api.apiKeys.remove)).resolves.toBeNull();
    });

    test("only removes keys for the authenticated user", async () => {
      const t = convexTest(schema, modules);
      const asAlice = t.withIdentity({ name: "Alice" });
      const asBob = t.withIdentity({ name: "Bob" });

      await asAlice.mutation(api.apiKeys.save, {
        encryptedData: "alice-data",
        iv: "alice-iv",
      });
      await asBob.mutation(api.apiKeys.save, {
        encryptedData: "bob-data",
        iv: "bob-iv",
      });

      await asAlice.mutation(api.apiKeys.remove);

      const aliceKeys = await asAlice.query(api.apiKeys.load);
      const bobKeys = await asBob.query(api.apiKeys.load);

      expect(aliceKeys).toBeNull();
      expect(bobKeys).toMatchObject({ encryptedData: "bob-data" });
    });
  });
});
