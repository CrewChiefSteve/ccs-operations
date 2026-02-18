import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

// ============================================================
// BUILD ORDERS — Production Tracking
// ============================================================
// Dashboard contract: api.inventory.buildOrders.list / .create / .updateStatus
// ============================================================

export const list = query({
  args: {
    search: v.optional(v.string()),       // Dashboard contract
    status: v.optional(v.string()),
    product: v.optional(v.string()),      // Dashboard contract name
    productName: v.optional(v.string()),  // Schema name
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const productFilter = args.product ?? args.productName;

    if (args.status) {
      const results = await ctx.db
        .query("buildOrders")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(args.limit ?? 50);

      return maybeSearch(results, args.search);
    }
    if (productFilter) {
      const results = await ctx.db
        .query("buildOrders")
        .withIndex("by_product", (q) => q.eq("productName", productFilter))
        .order("desc")
        .take(args.limit ?? 50);

      return maybeSearch(results, args.search);
    }

    const results = await ctx.db.query("buildOrders").order("desc").take(args.limit ?? 50);
    return maybeSearch(results, args.search);
  },
});

function maybeSearch(results: any[], search?: string) {
  if (!search || search.trim().length === 0) return results;
  const term = search.toLowerCase();
  return results.filter(
    (b: any) =>
      b.buildNumber.toLowerCase().includes(term) ||
      b.productName.toLowerCase().includes(term) ||
      (b.notes && b.notes.toLowerCase().includes(term))
  );
}

export const getById = query({
  args: { id: v.id("buildOrders") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    // Contract args
    buildNumber: v.optional(v.string()),  // Contract sends this; backend auto-generates if missing
    product: v.optional(v.string()),      // Dashboard contract name
    // Schema args
    productName: v.optional(v.string()),
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
    const pName = args.productName ?? args.product;
    if (!pName) throw new Error("Must provide product or productName");

    // Generate build number if not provided
    let buildNumber = args.buildNumber;
    if (!buildNumber) {
      const year = new Date().getFullYear();
      const productCode = pName.substring(0, 2).toUpperCase();
      const existing = await ctx.db
        .query("buildOrders")
        .withIndex("by_product", (q) => q.eq("productName", pName))
        .order("desc")
        .take(1);

      let seq = 1;
      if (existing.length > 0) {
        const match = existing[0].buildNumber.match(/BUILD-\w+-\d{4}-(\d+)/);
        if (match) seq = parseInt(match[1]) + 1;
      }

      buildNumber = `BUILD-${productCode}-${year}-${String(seq).padStart(3, "0")}`;
    }

    return await ctx.db.insert("buildOrders", {
      buildNumber,
      productName: pName,
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
  qc: ["complete", "in_progress"],
  complete: [],
  cancelled: [],
};

// ============================================================
// CONTRACT: api.inventory.buildOrders.updateStatus
// Accepts both contract args (buildOrderId, status) and
// extended args (id, newStatus) for MCP/agent use.
// ============================================================
export const updateStatus = mutation({
  args: {
    // Contract args
    buildOrderId: v.optional(v.id("buildOrders")),
    status: v.optional(v.string()),
    // Extended args
    id: v.optional(v.id("buildOrders")),
    newStatus: v.optional(v.string()),
    qcStatus: v.optional(v.string()),
    qcNotes: v.optional(v.string()),
    assignedTo: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const orderId = args.buildOrderId ?? args.id;
    const targetStatus = args.status ?? args.newStatus;

    if (!orderId) throw new Error("Must provide buildOrderId or id");
    if (!targetStatus) throw new Error("Must provide status or newStatus");

    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Build order not found");

    const allowed = BUILD_TRANSITIONS[order.status];
    if (!allowed || !allowed.includes(targetStatus)) {
      throw new Error(
        `Cannot transition build from "${order.status}" to "${targetStatus}". Allowed: ${allowed?.join(", ")}`
      );
    }

    const updates: Record<string, unknown> = {
      status: targetStatus,
      updatedAt: Date.now(),
    };

    if (targetStatus === "in_progress" && !order.actualStart) {
      updates.actualStart = Date.now();
    }
    if (targetStatus === "complete") {
      updates.completedAt = Date.now();
    }
    if (args.qcStatus) updates.qcStatus = args.qcStatus;
    if (args.qcNotes) updates.qcNotes = args.qcNotes;
    if (args.assignedTo) updates.assignedTo = args.assignedTo;
    if (args.notes) updates.notes = args.notes;

    await ctx.db.patch(orderId, updates);
    return { id: orderId, status: targetStatus };
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
