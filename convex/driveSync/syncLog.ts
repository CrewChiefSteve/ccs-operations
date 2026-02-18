import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

// ============================================================
// DRIVE SYNC LOG — Sync Audit Trail
// ============================================================

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("driveSyncLog")
      .withIndex("by_startedAt")
      .order("desc")
      .take(args.limit ?? 20);
  },
});

export const getLatest = query({
  handler: async (ctx) => {
    const results = await ctx.db
      .query("driveSyncLog")
      .withIndex("by_startedAt")
      .order("desc")
      .take(1);
    return results[0] ?? null;
  },
});

export const startSync = mutation({
  args: {
    syncType: v.string(),
    triggeredBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("driveSyncLog", {
      syncType: args.syncType,
      status: "started",
      startedAt: Date.now(),
      triggeredBy: args.triggeredBy,
    });
  },
});

export const completeSync = mutation({
  args: {
    id: v.id("driveSyncLog"),
    filesProcessed: v.number(),
    filesAdded: v.number(),
    filesUpdated: v.number(),
    filesDeleted: v.number(),
    errors: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const log = await ctx.db.get(args.id);
    if (!log) throw new Error("Sync log not found");

    const now = Date.now();
    await ctx.db.patch(args.id, {
      status: args.errors && args.errors.length > 0 ? "failed" : "completed",
      filesProcessed: args.filesProcessed,
      filesAdded: args.filesAdded,
      filesUpdated: args.filesUpdated,
      filesDeleted: args.filesDeleted,
      errors: args.errors,
      completedAt: now,
      durationMs: now - log.startedAt,
    });
    return args.id;
  },
});
