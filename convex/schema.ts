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
    gatewayUrl: v.string(),
    state: v.string(),
    poolState: v.optional(v.union(
      v.literal("active"),
      v.literal("creating"),
      v.literal("stopped"),
    )),
    currentSkillPath: v.optional(v.string()),
    configHash: v.optional(v.string()),
    installedSkills: v.optional(v.array(v.string())),
    gatewayUrlCreatedAt: v.optional(v.number()),
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

  skillTrials: defineTable({
    tokenIdentifier: v.string(),
    sandboxId: v.string(),
    skillPath: v.string(),
    skillName: v.string(),
    startedAt: v.number(),
  }).index("by_token", ["tokenIdentifier"]),

  chatErrors: defineTable({
    tokenIdentifier: v.string(),
    sandboxId: v.string(),
    skillPath: v.string(),
    errorType: v.string(),
    errorMessage: v.string(),
    providerName: v.string(),
    model: v.string(),
    createdAt: v.number(),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_sandbox", ["sandboxId"]),

  chatSessions: defineTable({
    tokenIdentifier: v.string(),
    skillPath: v.string(),
    title: v.string(),
    model: v.string(),
    messages: v.array(v.object({
      role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
      content: v.string(),
    })),
    messageCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_token_skill", ["tokenIdentifier", "skillPath"]),
});
