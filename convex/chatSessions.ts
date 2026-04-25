import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

const messageValidator = v.object({
  role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
  content: v.string(),
})

type ChatSessionMessage = {
  role: "user" | "assistant" | "system"
  content: string
}

function compactRepeatedTurns(messages: ChatSessionMessage[]): ChatSessionMessage[] {
  const compacted: ChatSessionMessage[] = []
  for (const message of messages) {
    compacted.push(message)
    const n = compacted.length
    if (n < 4) continue
    const firstUser = compacted[n - 4]
    const firstAssistant = compacted[n - 3]
    const secondUser = compacted[n - 2]
    const secondAssistant = compacted[n - 1]
    if (
      firstUser.role === "user" &&
      firstAssistant.role === "assistant" &&
      secondUser.role === "user" &&
      secondAssistant.role === "assistant" &&
      firstUser.content === secondUser.content &&
      firstAssistant.content === secondAssistant.content
    ) {
      compacted.splice(n - 2, 2)
    }
  }
  return compacted
}

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

    const session = await ctx.db.get("chatSessions", args.sessionId)
    if (!session || session.tokenIdentifier !== identity.tokenIdentifier) {
      throw new Error("Session not found")
    }

    const duplicateTail =
      args.messages.length > 0 &&
      session.messages.length >= args.messages.length &&
      args.messages.every((message, index) => {
        const existing = session.messages[session.messages.length - args.messages.length + index]
        return existing?.role === message.role && existing.content === message.content
      })
    const updated = compactRepeatedTurns(duplicateTail ? session.messages : [...session.messages, ...args.messages])
    const patch: Record<string, unknown> = {
      messages: updated,
      messageCount: updated.length,
      updatedAt: Date.now(),
    }
    if (args.title) {
      patch.title = args.title
    }
    await ctx.db.patch("chatSessions", args.sessionId, patch)
    return null
  },
})

export const get = query({
  args: { sessionId: v.id("chatSessions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const session = await ctx.db.get("chatSessions", args.sessionId)
    if (!session || session.tokenIdentifier !== identity.tokenIdentifier) {
      return null
    }
    const messages = compactRepeatedTurns(session.messages)
    return { ...session, messages, messageCount: messages.length }
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

    return sessions.map((s) => {
      const messages = compactRepeatedTurns(s.messages)
      return {
        _id: s._id,
        skillPath: s.skillPath,
        title: s.title,
        model: s.model,
        workspacePath: s.workspacePath,
        messageCount: messages.length,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }
    })
  },
})

export const remove = mutation({
  args: { sessionId: v.id("chatSessions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Not authenticated")

    const session = await ctx.db.get("chatSessions", args.sessionId)
    if (session && session.tokenIdentifier === identity.tokenIdentifier) {
      await ctx.db.delete("chatSessions", args.sessionId)
    }
    return null
  },
})
