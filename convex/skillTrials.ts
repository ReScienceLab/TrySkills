import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const record = mutation({
  args: {
    sandboxId: v.string(),
    skillPath: v.string(),
    skillName: v.string(),
  },
  returns: v.id("skillTrials"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return await ctx.db.insert("skillTrials", {
      tokenIdentifier: identity.tokenIdentifier,
      sandboxId: args.sandboxId,
      skillPath: args.skillPath,
      skillName: args.skillName,
      startedAt: Date.now(),
    });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.db
      .query("skillTrials")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .order("desc")
      .take(50);
  },
});
