import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";

// ============================================================
// AGENT TASKS — Meat Bag Director Task System
// ============================================================
// Dashboard contract: api.agent.tasks.list / .create / .updateStatus / .complete
// Contract uses "category" where schema uses "type".
// ============================================================

export const list = query({
  args: {
    status: v.optional(v.string()),
    category: v.optional(v.string()),     // Dashboard contract name
    type: v.optional(v.string()),         // Schema name
    priority: v.optional(v.string()),
    assignedTo: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Map contract "category" to schema "type"
    const typeFilter = args.category ?? args.type;

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
    if (typeFilter) {
      return await ctx.db
        .query("tasks")
        .withIndex("by_type", (q) => q.eq("type", typeFilter))
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

    return [...pending, ...assigned, ...inProgress].sort((a, b) => {
      const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
      return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
    });
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
    // Accept both contract "category" and schema "type"
    category: v.optional(v.string()),
    type: v.optional(v.string()),
    priority: v.optional(v.string()),     // Contract says required, but default to "normal"
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
    const taskType = args.type ?? args.category ?? "general";
    const now = Date.now();
    const slaHours = args.slaHours ?? 24;
    const dueAt = args.dueAt ?? now + slaHours * 60 * 60 * 1000;

    return await ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      type: taskType,
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

// ============================================================
// CONTRACT: api.agent.tasks.updateStatus
// Generic status update — validates transitions.
// ============================================================
const TASK_TRANSITIONS: Record<string, string[]> = {
  pending: ["assigned", "in_progress", "blocked", "cancelled"],
  assigned: ["in_progress", "blocked", "cancelled"],
  in_progress: ["completed", "blocked", "escalated", "cancelled"],
  blocked: ["in_progress", "assigned", "cancelled"],
  completed: ["verified"],
  verified: [],
  escalated: ["in_progress", "assigned", "cancelled"],
  cancelled: [],
};

export const updateStatus = mutation({
  args: {
    // Contract args
    taskId: v.optional(v.id("tasks")),
    status: v.optional(v.string()),
    // Extended args
    id: v.optional(v.id("tasks")),
    newStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tId = args.taskId ?? args.id;
    const targetStatus = args.status ?? args.newStatus;

    if (!tId) throw new Error("Must provide taskId or id");
    if (!targetStatus) throw new Error("Must provide status or newStatus");

    const task = await ctx.db.get(tId);
    if (!task) throw new Error("Task not found");

    const allowed = TASK_TRANSITIONS[task.status];
    if (allowed && !allowed.includes(targetStatus)) {
      throw new Error(
        `Cannot transition task from "${task.status}" to "${targetStatus}". Allowed: ${allowed.join(", ")}`
      );
    }

    const updates: Record<string, unknown> = {
      status: targetStatus,
      updatedAt: Date.now(),
    };

    if (targetStatus === "completed") {
      updates.completedAt = Date.now();
    }

    await ctx.db.patch(tId, updates);
    return { id: tId, status: targetStatus };
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

// ============================================================
// CONTRACT: api.agent.tasks.complete
// Accepts both contract args (taskId) and schema args (id).
// completedBy defaults to "dashboard" if not provided.
// ============================================================
export const complete = mutation({
  args: {
    // Contract args
    taskId: v.optional(v.id("tasks")),
    // Schema args
    id: v.optional(v.id("tasks")),
    completedBy: v.optional(v.string()),  // Contract doesn't send this; default to "dashboard"
    completionNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const tId = args.taskId ?? args.id;
    if (!tId) throw new Error("Must provide taskId or id");

    const task = await ctx.db.get(tId);
    if (!task) throw new Error("Task not found");

    await ctx.db.patch(tId, {
      status: "completed",
      completedAt: Date.now(),
      completedBy: args.completedBy ?? "dashboard",
      completionNotes: args.completionNotes,
      updatedAt: Date.now(),
    });
    return tId;
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

    if (newLevel === 1) updates.priority = "high";
    if (newLevel >= 2) updates.priority = "urgent";
    if (args.newPriority) updates.priority = args.newPriority;

    await ctx.db.patch(args.id, updates);

    await ctx.scheduler.runAfter(0, internal.notifications.sendPush, {
      title: `\u{1F4CB} Task Escalated: ${task.title}`,
      body: `Escalation level ${newLevel}. ${task.description.slice(0, 120)}`,
      data: { type: "task", taskId: args.id.toString() },
      priority: "high",
    });

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
