import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";

// ============================================================
// AGENT ALERTS — Operational Alert Management
// ============================================================
// Dashboard contract: api.agent.alerts.list / .acknowledge / .resolve / .dismiss
// Contract uses "alertId" where schema uses "id".
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
    const alertId = await ctx.db.insert("alerts", {
      ...args,
      status: "active",
      agentGenerated: args.agentGenerated ?? false,
      updatedAt: Date.now(),
    });

    if (args.severity === "critical") {
      await ctx.scheduler.runAfter(0, internal.notifications.sendPush, {
        title: `\u{1F6A8} ${args.title}`,
        body: args.message.slice(0, 178),
        data: { type: "alert", alertId: alertId.toString(), severity: args.severity },
        priority: "high",
      });
    } else if (args.severity === "warning") {
      await ctx.scheduler.runAfter(0, internal.notifications.sendPush, {
        title: `\u26A0\uFE0F ${args.title}`,
        body: args.message.slice(0, 178),
        data: { type: "alert", alertId: alertId.toString(), severity: args.severity },
        priority: "default",
      });
    }

    return alertId;
  },
});

// ============================================================
// CONTRACT: api.agent.alerts.acknowledge
// Accepts both alertId (contract) and id (schema).
// acknowledgedBy defaults to "dashboard" if not provided.
// ============================================================
export const acknowledge = mutation({
  args: {
    alertId: v.optional(v.id("alerts")),  // Contract arg
    id: v.optional(v.id("alerts")),       // Schema arg
    acknowledgedBy: v.optional(v.string()),  // Contract doesn't send; default to "dashboard"
  },
  handler: async (ctx, args) => {
    const aId = args.alertId ?? args.id;
    if (!aId) throw new Error("Must provide alertId or id");

    const alert = await ctx.db.get(aId);
    if (!alert) throw new Error("Alert not found");
    if (alert.status !== "active") throw new Error("Alert is not active");

    await ctx.db.patch(aId, {
      status: "acknowledged",
      acknowledgedBy: args.acknowledgedBy ?? "dashboard",
      acknowledgedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return aId;
  },
});

// ============================================================
// CONTRACT: api.agent.alerts.resolve
// Accepts both alertId (contract) and id (schema).
// ============================================================
export const resolve = mutation({
  args: {
    alertId: v.optional(v.id("alerts")),  // Contract arg
    id: v.optional(v.id("alerts")),       // Schema arg
    resolvedBy: v.string(),
    resolvedAction: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const aId = args.alertId ?? args.id;
    if (!aId) throw new Error("Must provide alertId or id");

    const alert = await ctx.db.get(aId);
    if (!alert) throw new Error("Alert not found");

    await ctx.db.patch(aId, {
      status: "resolved",
      resolvedBy: args.resolvedBy,
      resolvedAt: Date.now(),
      resolvedAction: args.resolvedAction,
      updatedAt: Date.now(),
    });
    return aId;
  },
});

// ============================================================
// CONTRACT: api.agent.alerts.dismiss
// Accepts both alertId (contract) and id (schema).
// ============================================================
export const dismiss = mutation({
  args: {
    alertId: v.optional(v.id("alerts")),  // Contract arg
    id: v.optional(v.id("alerts")),       // Schema arg
  },
  handler: async (ctx, args) => {
    const aId = args.alertId ?? args.id;
    if (!aId) throw new Error("Must provide alertId or id");

    await ctx.db.patch(aId, {
      status: "dismissed",
      updatedAt: Date.now(),
    });
    return aId;
  },
});

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
