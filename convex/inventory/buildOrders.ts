import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

// ============================================================
// BUILD ORDERS — Production Tracking
// ============================================================

export const list = query({
  args: {
    status: v.optional(v.string()),
    productName: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("buildOrders")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(args.limit ?? 50);
    }
    if (args.productName) {
      return await ctx.db
        .query("buildOrders")
        .withIndex("by_product", (q) => q.eq("productName", args.productName!))
        .order("desc")
        .take(args.limit ?? 50);
    }
    return await ctx.db.query("buildOrders").order("desc").take(args.limit ?? 50);
  },
});

export const getById = query({
  args: { id: v.id("buildOrders") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    productName: v.string(),
    quantity: v.number(),
    priority: v.optional(v.string()),
    scheduledStart: v.optional(v.number()),
    bomVersion: v.optional(v.string()),
    assignedTo: v.optional(v.string()),
    driveProductionDocId: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Generate build number
    const year = new Date().getFullYear();
    const productCode = args.productName.substring(0, 2).toUpperCase();
    const existing = await ctx.db
      .query("buildOrders")
      .withIndex("by_product", (q) => q.eq("productName", args.productName))
      .order("desc")
      .take(1);

    let seq = 1;
    if (existing.length > 0) {
      const match = existing[0].buildNumber.match(/BUILD-\w+-\d{4}-(\d+)/);
      if (match) seq = parseInt(match[1]) + 1;
    }

    const buildNumber = `BUILD-${productCode}-${year}-${String(seq).padStart(3, "0")}`;

    return await ctx.db.insert("buildOrders", {
      buildNumber,
      productName: args.productName,
      quantity: args.quantity,
      status: "planned",
      priority: args.priority ?? "normal",
      scheduledStart: args.scheduledStart,
      bomVersion: args.bomVersion,
      assignedTo: args.assignedTo,
      driveProductionDocId: args.driveProductionDocId,
      notes: args.notes,
      createdBy: args.createdBy,
      updatedAt: Date.now(),
    });
  },
});

const BUILD_TRANSITIONS: Record<string, string[]> = {
  planned: ["materials_reserved", "cancelled"],
  materials_reserved: ["in_progress", "planned", "cancelled"],
  in_progress: ["qc", "cancelled"],
  qc: ["complete", "in_progress"],  // Can go back for rework
  complete: [],
  cancelled: [],
};

export const updateStatus = mutation({
  args: {
    id: v.id("buildOrders"),
    newStatus: v.string(),
    qcStatus: v.optional(v.string()),
    qcNotes: v.optional(v.string()),
    assignedTo: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order) throw new Error("Build order not found");

    const allowed = BUILD_TRANSITIONS[order.status];
    if (!allowed || !allowed.includes(args.newStatus)) {
      throw new Error(
        `Cannot transition build from "${order.status}" to "${args.newStatus}". Allowed: ${allowed?.join(", ")}`
      );
    }

    const updates: Record<string, unknown> = {
      status: args.newStatus,
      updatedAt: Date.now(),
    };

    if (args.newStatus === "in_progress" && !order.actualStart) {
      updates.actualStart = Date.now();
    }
    if (args.newStatus === "complete") {
      updates.completedAt = Date.now();
    }
    if (args.qcStatus) updates.qcStatus = args.qcStatus;
    if (args.qcNotes) updates.qcNotes = args.qcNotes;
    if (args.assignedTo) updates.assignedTo = args.assignedTo;
    if (args.notes) updates.notes = args.notes;

    await ctx.db.patch(args.id, updates);
    return { id: args.id, status: args.newStatus };
  },
});

export const update = mutation({
  args: {
    id: v.id("buildOrders"),
    quantity: v.optional(v.number()),
    priority: v.optional(v.string()),
    scheduledStart: v.optional(v.number()),
    bomVersion: v.optional(v.string()),
    assignedTo: v.optional(v.string()),
    driveProductionDocId: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Build order not found");

    const cleanUpdates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) cleanUpdates[key] = value;
    }

    await ctx.db.patch(id, cleanUpdates);
    return id;
  },
});
