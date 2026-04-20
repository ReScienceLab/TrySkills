import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("userSnapshots")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
  },
});

export const upsert = mutation({
  args: {
    snapshotName: v.string(),
    state: v.union(
      v.literal("building"),
      v.literal("active"),
      v.literal("error"),
    ),
    errorReason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("userSnapshots")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (existing) {
      await ctx.db.patch("userSnapshots", existing._id, {
        snapshotName: args.snapshotName,
        state: args.state,
        errorReason: args.errorReason,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("userSnapshots", {
        tokenIdentifier: identity.tokenIdentifier,
        snapshotName: args.snapshotName,
        state: args.state,
        errorReason: args.errorReason,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});
