import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const save = mutation({
  args: {
    encryptedData: v.string(),
    iv: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("apiKeys")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (existing) {
      await ctx.db.patch("apiKeys", existing._id, {
        encryptedData: args.encryptedData,
        iv: args.iv,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("apiKeys", {
        tokenIdentifier: identity.tokenIdentifier,
        encryptedData: args.encryptedData,
        iv: args.iv,
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

export const load = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("apiKeys"),
      _creationTime: v.number(),
      tokenIdentifier: v.string(),
      encryptedData: v.string(),
      iv: v.string(),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("apiKeys")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();
  },
});

export const remove = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("apiKeys")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (existing) {
      await ctx.db.delete("apiKeys", existing._id);
    }
    return null;
  },
});
