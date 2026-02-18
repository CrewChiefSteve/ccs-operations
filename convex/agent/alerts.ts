import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

// ============================================================
// AGENT ALERTS — Operational Alert Management
// ============================================================

export const list = query({
  args: {
    status: v.optional(v.string()),
    severity: v.optional(v.string()),
    type: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("alerts")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(args.limit ?? 50);
    }
    if (args.severity) {
      return await ctx.db
        .query("alerts")
        .withIndex("by_severity", (q) => q.eq("severity", args.severity!))
        .order("desc")
        .take(args.limit ?? 50);
    }
    if (args.type) {
      return await ctx.db
        .query("alerts")
        .withIndex("by_type", (q) => q.eq("type", args.type!))
        .order("desc")
        .take(args.limit ?? 50);
    }
    return await ctx.db.query("alerts").order("desc").take(args.limit ?? 50);
  },
});

export const getActive = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("alerts")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .order("desc")
      .collect();
  },
});

export const create = mutation({
  args: {
    type: v.string(),
    severity: v.string(),
    title: v.string(),
    message: v.string(),
    componentId: v.optional(v.id("components")),
    purchaseOrderId: v.optional(v.id("purchaseOrders")),
    buildOrderId: v.optional(v.id("buildOrders")),
    locationId: v.optional(v.id("locations")),
    driveFileId: v.optional(v.string()),
    agentGenerated: v.optional(v.boolean()),
    agentContext: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("alerts", {
      ...args,
      status: "active",
      agentGenerated: args.agentGenerated ?? false,
      updatedAt: Date.now(),
    });
  },
});

export const acknowledge = mutation({
  args: {
    id: v.id("alerts"),
    acknowledgedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const alert = await ctx.db.get(args.id);
    if (!alert) throw new Error("Alert not found");
    if (alert.status !== "active") throw new Error("Alert is not active");

    await ctx.db.patch(args.id, {
      status: "acknowledged",
      acknowledgedBy: args.acknowledgedBy,
      acknowledgedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const resolve = mutation({
  args: {
    id: v.id("alerts"),
    resolvedBy: v.string(),
    resolvedAction: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const alert = await ctx.db.get(args.id);
    if (!alert) throw new Error("Alert not found");

    await ctx.db.patch(args.id, {
      status: "resolved",
      resolvedBy: args.resolvedBy,
      resolvedAt: Date.now(),
      resolvedAction: args.resolvedAction,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const dismiss = mutation({
  args: { id: v.id("alerts") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "dismissed",
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

// Dashboard stats
export const stats = query({
  handler: async (ctx) => {
    const active = await ctx.db
      .query("alerts")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const a of active) {
      bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;
      byType[a.type] = (byType[a.type] ?? 0) + 1;
    }

    return {
      activeCount: active.length,
      bySeverity,
      byType,
    };
  },
});
