import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    sandboxId: v.string(),
    skillPath: v.string(),
    gatewayUrl: v.string(),
    state: v.optional(v.string()),
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
  },
  returns: v.id("sandboxes"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return await ctx.db.insert("sandboxes", {
      tokenIdentifier: identity.tokenIdentifier,
      sandboxId: args.sandboxId,
      skillPath: args.skillPath,
      gatewayUrl: args.gatewayUrl,
      state: args.state ?? "running",
      poolState: args.poolState,
      currentSkillPath: args.currentSkillPath,
      configHash: args.configHash,
      installedSkills: args.installedSkills,
      gatewayUrlCreatedAt: args.gatewayUrlCreatedAt,
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

export const getSandbox = query({
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

    const sandbox = sandboxes.find((s) => !s.sandboxId.startsWith("pending-"));
    if (!sandbox) {
      const STALE_PENDING_MS = 5 * 60 * 1000; // 5 min (covers slow/fallback cold creates)
      const now = Date.now();
      const pending = sandboxes.find(
        (s) => s.sandboxId.startsWith("pending-") && now - s.createdAt < STALE_PENDING_MS,
      );
      if (pending) return { status: "creating" as const };
      return null;
    }

    return {
      status: "found" as const,
      sandboxId: sandbox.sandboxId,
      gatewayUrl: sandbox.gatewayUrl,
      poolState: sandbox.poolState,
      configHash: sandbox.configHash,
      installedSkills: sandbox.installedSkills,
      gatewayUrlCreatedAt: sandbox.gatewayUrlCreatedAt,
      lastHeartbeat: sandbox.lastHeartbeat,
      currentSkillPath: sandbox.currentSkillPath,
    };
  },
});

export const acquireCreateLock = mutation({
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

    const real = sandboxes.find((s) => !s.sandboxId.startsWith("pending-"));
    if (real) {
      return { status: "exists" as const, sandboxId: real.sandboxId };
    }

    const STALE_PENDING_MS = 5 * 60 * 1000;
    const now = Date.now();

    // Clean up stale pending records from crashed tabs
    for (const s of sandboxes) {
      if (s.sandboxId.startsWith("pending-") && now - s.createdAt > STALE_PENDING_MS) {
        await ctx.db.delete("sandboxes", s._id);
      }
    }

    const freshPending = sandboxes.find(
      (s) => s.sandboxId.startsWith("pending-") && now - s.createdAt <= STALE_PENDING_MS,
    );
    if (freshPending) {
      return { status: "creating" as const };
    }

    const placeholderId = `pending-${Date.now()}`;
    await ctx.db.insert("sandboxes", {
      tokenIdentifier: identity.tokenIdentifier,
      sandboxId: placeholderId,
      skillPath: "",
      gatewayUrl: "",
      state: "creating",
      poolState: "creating",
      createdAt: Date.now(),
    });
    return { status: "acquired" as const, placeholderId };
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
      gatewayUrl: reusable.gatewayUrl,
    };
  },
});

export const updatePoolState = mutation({
  args: {
    sandboxId: v.string(),
    poolState: v.union(
      v.literal("active"),
      v.literal("creating"),
      v.literal("stopped"),
    ),
    currentSkillPath: v.optional(v.string()),
    gatewayUrl: v.optional(v.string()),
    configHash: v.optional(v.string()),
    installedSkills: v.optional(v.array(v.string())),
    gatewayUrlCreatedAt: v.optional(v.number()),
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
      if (args.gatewayUrl !== undefined) {
        patch.gatewayUrl = args.gatewayUrl;
      }
      if (args.configHash !== undefined) {
        patch.configHash = args.configHash;
      }
      if (args.installedSkills !== undefined) {
        patch.installedSkills = args.installedSkills;
      }
      if (args.gatewayUrlCreatedAt !== undefined) {
        patch.gatewayUrlCreatedAt = args.gatewayUrlCreatedAt;
      }
      await ctx.db.patch("sandboxes", sandbox._id, patch);
    }
    return null;
  },
});

export const addInstalledSkill = mutation({
  args: {
    sandboxId: v.string(),
    skillPath: v.string(),
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
      const current = sandbox.installedSkills ?? [];
      if (!current.includes(args.skillPath)) {
        await ctx.db.patch("sandboxes", sandbox._id, {
          installedSkills: [...current, args.skillPath],
        });
      }
    }
    return null;
  },
});

export const syncInstalledSkills = mutation({
  args: {
    sandboxId: v.string(),
    discoveredSkills: v.array(v.string()),
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
      const current = sandbox.installedSkills ?? [];
      const newSkills = args.discoveredSkills.filter((s) => !current.includes(s));
      if (newSkills.length > 0) {
        await ctx.db.patch("sandboxes", sandbox._id, {
          installedSkills: [...current, ...newSkills],
        });
      }
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
