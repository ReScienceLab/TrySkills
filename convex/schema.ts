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
    poolState: v.optional(v.union(
      v.literal("warm"),
      v.literal("active"),
      v.literal("swapping"),
      v.literal("stopped"),
    )),
    currentSkillPath: v.optional(v.string()),
    cpu: v.optional(v.number()),
    memory: v.optional(v.number()),
    disk: v.optional(v.number()),
    region: v.optional(v.string()),
    lastHeartbeat: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_sandbox", ["sandboxId"]),

  userSnapshots: defineTable({
    tokenIdentifier: v.string(),
    snapshotName: v.string(),
    state: v.union(
      v.literal("building"),
      v.literal("active"),
      v.literal("error"),
    ),
    errorReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_token", ["tokenIdentifier"]),
});
