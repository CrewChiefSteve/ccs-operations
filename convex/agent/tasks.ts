import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

// ============================================================
// AGENT TASKS — Meat Bag Director Task System
// ============================================================

export const list = query({
  args: {
    status: v.optional(v.string()),
    priority: v.optional(v.string()),
    assignedTo: v.optional(v.string()),
    type: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("tasks")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(args.limit ?? 50);
    }
    if (args.assignedTo) {
      return await ctx.db
        .query("tasks")
        .withIndex("by_assignedTo", (q) => q.eq("assignedTo", args.assignedTo!))
        .order("desc")
        .take(args.limit ?? 50);
    }
    if (args.priority) {
      return await ctx.db
        .query("tasks")
        .withIndex("by_priority", (q) => q.eq("priority", args.priority!))
        .order("desc")
        .take(args.limit ?? 50);
    }
    if (args.type) {
      return await ctx.db
        .query("tasks")
        .withIndex("by_type", (q) => q.eq("type", args.type!))
        .order("desc")
        .take(args.limit ?? 50);
    }
    return await ctx.db.query("tasks").order("desc").take(args.limit ?? 50);
  },
});

export const getPending = query({
  args: { assignedTo: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.assignedTo) {
      const assigned = await ctx.db
        .query("tasks")
        .withIndex("by_assignedTo", (q) => q.eq("assignedTo", args.assignedTo!))
        .collect();
      return assigned.filter((t) => ["pending", "assigned", "in_progress"].includes(t.status));
    }

    const pending = await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    const assigned = await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "assigned"))
      .collect();
    const inProgress = await ctx.db
      .query("tasks")
      .withIndex("by_status", (q) => q.eq("status", "in_progress"))
      .collect();

    return [...pending, ...assigned, ...inProgress].sort(
      (a, b) => {
        const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
        return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
      }
    );
  },
});

export const getById = query({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    type: v.string(),
    priority: v.optional(v.string()),
    assignedTo: v.optional(v.string()),
    dueAt: v.optional(v.number()),
    slaHours: v.optional(v.number()),
    componentId: v.optional(v.id("components")),
    locationId: v.optional(v.id("locations")),
    purchaseOrderId: v.optional(v.id("purchaseOrders")),
    buildOrderId: v.optional(v.id("buildOrders")),
    alertId: v.optional(v.id("alerts")),
    agentGenerated: v.optional(v.boolean()),
    agentContext: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const slaHours = args.slaHours ?? 24;
    const dueAt = args.dueAt ?? now + slaHours * 60 * 60 * 1000;

    return await ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      type: args.type,
      priority: args.priority ?? "normal",
      status: args.assignedTo ? "assigned" : "pending",
      assignedTo: args.assignedTo,
      dueAt,
      slaHours,
      escalationLevel: 0,
      componentId: args.componentId,
      locationId: args.locationId,
      purchaseOrderId: args.purchaseOrderId,
      buildOrderId: args.buildOrderId,
      alertId: args.alertId,
      agentGenerated: args.agentGenerated ?? false,
      agentContext: args.agentContext,
      updatedAt: now,
    });
  },
});

export const assign = mutation({
  args: {
    id: v.id("tasks"),
    assignedTo: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Task not found");

    await ctx.db.patch(args.id, {
      assignedTo: args.assignedTo,
      status: "assigned",
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const startWork = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Task not found");

    await ctx.db.patch(args.id, {
      status: "in_progress",
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const complete = mutation({
  args: {
    id: v.id("tasks"),
    completedBy: v.string(),
    completionNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Task not found");

    await ctx.db.patch(args.id, {
      status: "completed",
      completedAt: Date.now(),
      completedBy: args.completedBy,
      completionNotes: args.completionNotes,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const verify = mutation({
  args: {
    id: v.id("tasks"),
    verifiedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Task not found");
    if (task.status !== "completed") throw new Error("Task must be completed before verification");

    await ctx.db.patch(args.id, {
      status: "verified",
      verifiedAt: Date.now(),
      verifiedBy: args.verifiedBy,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

export const escalate = mutation({
  args: {
    id: v.id("tasks"),
    newPriority: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.id);
    if (!task) throw new Error("Task not found");

    const newLevel = task.escalationLevel + 1;
    const updates: Record<string, unknown> = {
      escalationLevel: newLevel,
      escalatedAt: Date.now(),
      status: "escalated",
      updatedAt: Date.now(),
    };

    // Auto-bump priority on escalation
    if (newLevel === 1) updates.priority = "high";
    if (newLevel >= 2) updates.priority = "urgent";
    if (args.newPriority) updates.priority = args.newPriority;

    await ctx.db.patch(args.id, updates);
    return { id: args.id, escalationLevel: newLevel };
  },
});

export const cancel = mutation({
  args: {
    id: v.id("tasks"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "cancelled",
      completionNotes: args.reason,
      updatedAt: Date.now(),
    });
    return args.id;
  },
});

// Dashboard stats
export const stats = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("tasks").collect();
    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let overdue = 0;

    const now = Date.now();
    for (const t of all) {
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
      byType[t.type] = (byType[t.type] ?? 0) + 1;
      if (t.dueAt && t.dueAt < now && !["completed", "verified", "cancelled"].includes(t.status)) {
        overdue++;
      }
    }

    return { total: all.length, byStatus, byPriority, byType, overdue };
  },
});
