import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

const messageValidator = v.object({
  role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
  content: v.string(),
})

export const create = mutation({
  args: {
    skillPath: v.string(),
    title: v.string(),
    model: v.string(),
    workspacePath: v.optional(v.string()),
  },
  returns: v.id("chatSessions"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    return await ctx.db.insert("chatSessions", {
      tokenIdentifier: identity.tokenIdentifier,
      skillPath: args.skillPath,
      title: args.title,
      model: args.model,
      workspacePath: args.workspacePath,
      messages: [],
      messageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  },
})

export const appendMessages = mutation({
  args: {
    sessionId: v.id("chatSessions"),
    messages: v.array(messageValidator),
    title: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const session = await ctx.db.get(args.sessionId)
    if (!session || session.tokenIdentifier !== identity.tokenIdentifier) {
      throw new Error("Session not found")
    }

    const updated = [...session.messages, ...args.messages]
    const patch: Record<string, unknown> = {
      messages: updated,
      messageCount: updated.length,
      updatedAt: Date.now(),
    }
    if (args.title) {
      patch.title = args.title
    }
    await ctx.db.patch(args.sessionId, patch)
    return null
  },
})

export const get = query({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const session = await ctx.db.get(args.sessionId)
    if (!session || session.tokenIdentifier !== identity.tokenIdentifier) {
      return null
    }
    return session
  },
})

export const findBySkill = query({
  args: { skillPath: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_token_skill", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier).eq("skillPath", args.skillPath),
      )
      .order("desc")
      .take(1)

    return sessions[0] ?? null
  },
})

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const sessions = await ctx.db
      .query("chatSessions")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .order("desc")
      .take(100)

    return sessions.map((s) => ({
      _id: s._id,
      skillPath: s.skillPath,
      title: s.title,
      model: s.model,
      workspacePath: s.workspacePath,
      messageCount: s.messageCount,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }))
  },
})

export const remove = mutation({
  args: { sessionId: v.id("chatSessions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const session = await ctx.db.get(args.sessionId)
    if (session && session.tokenIdentifier === identity.tokenIdentifier) {
      await ctx.db.delete(args.sessionId)
    }
    return null
  },
})
