import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const record = mutation({
  args: {
    sandboxId: v.string(),
    skillPath: v.string(),
    errorType: v.string(),
    errorMessage: v.string(),
    providerName: v.string(),
    model: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    await ctx.db.insert("chatErrors", {
      tokenIdentifier: identity.tokenIdentifier,
      sandboxId: args.sandboxId,
      skillPath: args.skillPath,
      errorType: args.errorType,
      errorMessage: args.errorMessage,
      providerName: args.providerName,
      model: args.model,
      createdAt: Date.now(),
    })
    return null
  },
})

export const listRecent = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const errors = await ctx.db
      .query("chatErrors")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .order("desc")
      .take(20)

    return errors
  },
})
