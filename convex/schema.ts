import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  apiKeys: defineTable({
    tokenIdentifier: v.string(),
    encryptedData: v.string(),
    iv: v.string(),
    updatedAt: v.number(),
  }).index("by_token", ["tokenIdentifier"]),
});
