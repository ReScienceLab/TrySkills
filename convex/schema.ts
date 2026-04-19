import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  apiKeys: defineTable({
    tokenIdentifier: v.string(),
    encryptedData: v.string(),
    iv: v.string(),
    updatedAt: v.number(),
  }).index("by_token", ["tokenIdentifier"]),

  sandboxes: defineTable({
    tokenIdentifier: v.string(),
    sandboxId: v.string(),
    skillPath: v.string(),
    webuiUrl: v.string(),
    state: v.string(),
    cpu: v.optional(v.number()),
    memory: v.optional(v.number()),
    disk: v.optional(v.number()),
    region: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_sandbox", ["sandboxId"]),
});
