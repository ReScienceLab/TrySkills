import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    sandboxId: v.string(),
    skillPath: v.string(),
    webuiUrl: v.string(),
    state: v.optional(v.string()),
    poolState: v.optional(v.union(
      v.literal("active"),
      v.literal("installing"),
      v.literal("stopped"),
    )),
    currentSkillPath: v.optional(v.string()),
    configHash: v.optional(v.string()),
    installedSkills: v.optional(v.array(v.string())),
    webuiUrlCreatedAt: v.optional(v.number()),
    cpu: v.optional(v.number()),
    memory: v.optional(v.number()),
    disk: v.optional(v.number()),
    region: v.optional(v.string()),
  },
  returns: v.id("sandboxes"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Enforce single sandbox per user: remove any existing non-pending records
    const existing = await ctx.db
      .query("sandboxes")
      .withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .collect();
    for (const old of existing) {
      if (!old.sandboxId.startsWith("pending-") && old.sandboxId !== args.sandboxId) {
        await ctx.db.delete("sandboxes", old._id);
      }
    }

    return await ctx.db.insert("sandboxes", {
      tokenIdentifier: identity.tokenIdentifier,
      sandboxId: args.sandboxId,
      skillPath: args.skillPath,
      webuiUrl: args.webuiUrl,
      state: args.state ?? "running",
      poolState: args.poolState,
      currentSkillPath: args.currentSkillPath,
      configHash: args.configHash,
      installedSkills: args.installedSkills,
      webuiUrlCreatedAt: args.webuiUrlCreatedAt,
      cpu: args.cpu,
      memory: args.memory,
      disk: args.disk,
      region: args.region,
      createdAt: Date.now(),
    });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.db
      .query("sandboxes")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .order("desc")
      // eslint-disable-next-line @convex-dev/no-collect-in-query
      .collect();
  },
});

export const updateState = mutation({
  args: {
    sandboxId: v.string(),
    state: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const sandbox = await ctx.db
      .query("sandboxes")
      .withIndex("by_sandbox", (q) => q.eq("sandboxId", args.sandboxId))
      .unique();

    if (sandbox && sandbox.tokenIdentifier === identity.tokenIdentifier) {
      await ctx.db.patch("sandboxes", sandbox._id, { state: args.state });
    }
    return null;
  },
});

export const remove = mutation({
  args: {
    sandboxId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const sandbox = await ctx.db
      .query("sandboxes")
      .withIndex("by_sandbox", (q) => q.eq("sandboxId", args.sandboxId))
      .unique();

    if (sandbox && sandbox.tokenIdentifier === identity.tokenIdentifier) {
      await ctx.db.delete("sandboxes", sandbox._id);
    }
    return null;
  },
});

export const heartbeat = mutation({
  args: {
    sandboxId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const sandbox = await ctx.db
      .query("sandboxes")
      .withIndex("by_sandbox", (q) => q.eq("sandboxId", args.sandboxId))
      .unique();

    if (sandbox && sandbox.tokenIdentifier === identity.tokenIdentifier) {
      await ctx.db.patch("sandboxes", sandbox._id, { lastHeartbeat: Date.now() });
    }
    return null;
  },
});

export const claimSandbox = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const sandboxes = await ctx.db
      .query("sandboxes")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .collect();

    const reusable = sandboxes.find((s) => {
      if (s.sandboxId.startsWith("pending-")) return false;
      return s.poolState === "active" || s.poolState === "stopped";
    });
    if (!reusable) return null;

    await ctx.db.patch("sandboxes", reusable._id, { poolState: "installing" });
    return {
      sandboxId: reusable.sandboxId,
      webuiUrl: reusable.webuiUrl,
      currentSkillPath: reusable.currentSkillPath,
      poolState: reusable.poolState,
      configHash: reusable.configHash,
      installedSkills: reusable.installedSkills,
      webuiUrlCreatedAt: reusable.webuiUrlCreatedAt,
      lastHeartbeat: reusable.lastHeartbeat,
    };
  },
});

export const findReusable = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const sandboxes = await ctx.db
      .query("sandboxes")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      // eslint-disable-next-line @convex-dev/no-collect-in-query
      .collect();

    const reusable = sandboxes.find(
      (s) =>
        !s.sandboxId.startsWith("pending-") &&
        (s.poolState === "active" || s.poolState === "stopped"),
    );
    if (!reusable) return null;

    return {
      sandboxId: reusable.sandboxId,
      poolState: reusable.poolState,
      webuiUrl: reusable.webuiUrl,
    };
  },
});

export const updatePoolState = mutation({
  args: {
    sandboxId: v.string(),
    poolState: v.union(
      v.literal("active"),
      v.literal("installing"),
      v.literal("stopped"),
    ),
    currentSkillPath: v.optional(v.string()),
    webuiUrl: v.optional(v.string()),
    configHash: v.optional(v.string()),
    installedSkills: v.optional(v.array(v.string())),
    webuiUrlCreatedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const sandbox = await ctx.db
      .query("sandboxes")
      .withIndex("by_sandbox", (q) => q.eq("sandboxId", args.sandboxId))
      .unique();

    if (sandbox && sandbox.tokenIdentifier === identity.tokenIdentifier) {
      const patch: Record<string, unknown> = { poolState: args.poolState };
      if (args.currentSkillPath !== undefined) {
        patch.currentSkillPath = args.currentSkillPath;
      }
      if (args.webuiUrl !== undefined) {
        patch.webuiUrl = args.webuiUrl;
      }
      if (args.configHash !== undefined) {
        patch.configHash = args.configHash;
      }
      if (args.installedSkills !== undefined) {
        patch.installedSkills = args.installedSkills;
      }
      if (args.webuiUrlCreatedAt !== undefined) {
        patch.webuiUrlCreatedAt = args.webuiUrlCreatedAt;
      }
      await ctx.db.patch("sandboxes", sandbox._id, patch);
    }
    return null;
  },
});

export const listStale = internalQuery({
  args: {
    staleThresholdMs: v.number(),
    ageThresholdMs: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    // eslint-disable-next-line @convex-dev/no-collect-in-query
    const all = await ctx.db.query("sandboxes").collect();
    return all.filter((s) => {
      // Skip terminal states — only clean non-terminal (active/in-flight) records
      const terminal = ["error", "cleaning", "idle"];
      if (terminal.includes(s.state)) return false;
      const age = now - s.createdAt;
      if (age < args.ageThresholdMs) return false;
      const lastBeat = s.lastHeartbeat ?? s.createdAt;
      return now - lastBeat > args.staleThresholdMs;
    });
  },
});

export const internalRemove = internalMutation({
  args: {
    sandboxId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sandbox = await ctx.db
      .query("sandboxes")
      .withIndex("by_sandbox", (q) => q.eq("sandboxId", args.sandboxId))
      .unique();

    if (sandbox) {
      await ctx.db.delete("sandboxes", sandbox._id);
    }
    return null;
  },
});

export const internalMarkStopped = internalMutation({
  args: {
    sandboxId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sandbox = await ctx.db
      .query("sandboxes")
      .withIndex("by_sandbox", (q) => q.eq("sandboxId", args.sandboxId))
      .unique();

    if (sandbox) {
      await ctx.db.patch("sandboxes", sandbox._id, { poolState: "stopped" });
    }
    return null;
  },
});
