import { v } from "convex/values";
import { mutation, query, internalMutation } from "../_generated/server";

// ============================================================
// INVENTORY — Stock Level Management
// ============================================================
// Dashboard contract exports: listWithDetails, adjust
// Extended exports for MCP/agent: list, listEnriched, adjustQuantity, etc.
// ============================================================

export const list = query({
  args: {
    componentId: v.optional(v.id("components")),
    locationId: v.optional(v.id("locations")),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.componentId) {
      return await ctx.db
        .query("inventory")
        .withIndex("by_component", (q) => q.eq("componentId", args.componentId!))
        .collect();
    }
    if (args.locationId) {
      return await ctx.db
        .query("inventory")
        .withIndex("by_location", (q) => q.eq("locationId", args.locationId!))
        .collect();
    }
    if (args.status) {
      return await ctx.db
        .query("inventory")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    }
    return await ctx.db.query("inventory").take(args.limit ?? 200);
  },
});

export const getByComponentLocation = query({
  args: {
    componentId: v.id("components"),
    locationId: v.id("locations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("inventory")
      .withIndex("by_component_location", (q) =>
        q.eq("componentId", args.componentId).eq("locationId", args.locationId)
      )
      .unique();
  },
});

// ============================================================
// CONTRACT: api.inventory.stock.listWithDetails
// Returns enriched inventory rows matching the dashboard contract shape.
// ============================================================
export const listWithDetails = query({
  args: {
    search: v.optional(v.string()),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let records;
    if (args.status) {
      records = await ctx.db
        .query("inventory")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .take(args.limit ?? 200);
    } else {
      records = await ctx.db.query("inventory").take(args.limit ?? 200);
    }

    const enriched = await Promise.all(
      records.map(async (inv) => {
        const component = await ctx.db.get(inv.componentId);
        const location = await ctx.db.get(inv.locationId);
        return {
          _id: inv._id,
          componentId: inv.componentId,
          componentName: component?.name ?? "Unknown",
          partNumber: component?.partNumber ?? "Unknown",
          locationName: location?.name ?? "Unknown",
          quantity: inv.quantity,
          reservedQuantity: inv.reservedQty,
          availableQuantity: inv.availableQty,
          status: inv.status,
          costPerUnit: inv.costPerUnit,
          lastCountedAt: inv.lastCountedAt,
          updatedAt: inv.updatedAt,
        };
      })
    );

    // Client-side search filter (search across component name and part number)
    if (args.search && args.search.trim().length > 0) {
      const term = args.search.toLowerCase();
      return enriched.filter(
        (r) =>
          r.componentName.toLowerCase().includes(term) ||
          r.partNumber.toLowerCase().includes(term)
      );
    }

    return enriched;
  },
});

// Backward compat: listEnriched (used by MCP/agents)
export const listEnriched = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let records;
    if (args.status) {
      records = await ctx.db
        .query("inventory")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .take(args.limit ?? 200);
    } else {
      records = await ctx.db.query("inventory").take(args.limit ?? 200);
    }

    return await Promise.all(
      records.map(async (inv) => {
        const component = await ctx.db.get(inv.componentId);
        const location = await ctx.db.get(inv.locationId);
        return {
          ...inv,
          componentName: component?.name ?? "Unknown",
          componentPartNumber: component?.partNumber ?? "Unknown",
          componentCategory: component?.category,
          locationName: location?.name ?? "Unknown",
          locationCode: location?.code ?? "Unknown",
        };
      })
    );
  },
});

export const getTotalStock = query({
  args: { componentId: v.id("components") },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("inventory")
      .withIndex("by_component", (q) => q.eq("componentId", args.componentId))
      .collect();

    return {
      componentId: args.componentId,
      totalQuantity: records.reduce((sum, r) => sum + r.quantity, 0),
      totalReserved: records.reduce((sum, r) => sum + r.reservedQty, 0),
      totalAvailable: records.reduce((sum, r) => sum + r.availableQty, 0),
      locationCount: records.length,
      locations: records.map((r) => ({
        locationId: r.locationId,
        quantity: r.quantity,
        reserved: r.reservedQty,
        available: r.availableQty,
        status: r.status,
      })),
    };
  },
});

function computeStatus(quantity: number, minimumStock?: number, maximumStock?: number): string {
  if (quantity <= 0) return "out_of_stock";
  if (minimumStock && quantity <= minimumStock) return "low_stock";
  if (maximumStock && quantity > maximumStock) return "overstock";
  return "in_stock";
}

export const upsert = mutation({
  args: {
    componentId: v.id("components"),
    locationId: v.id("locations"),
    quantity: v.number(),
    minimumStock: v.optional(v.number()),
    maximumStock: v.optional(v.number()),
    costPerUnit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("inventory")
      .withIndex("by_component_location", (q) =>
        q.eq("componentId", args.componentId).eq("locationId", args.locationId)
      )
      .unique();

    const status = computeStatus(args.quantity, args.minimumStock, args.maximumStock);

    if (existing) {
      await ctx.db.patch(existing._id, {
        quantity: args.quantity,
        availableQty: args.quantity - existing.reservedQty,
        minimumStock: args.minimumStock ?? existing.minimumStock,
        maximumStock: args.maximumStock ?? existing.maximumStock,
        costPerUnit: args.costPerUnit ?? existing.costPerUnit,
        status,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert("inventory", {
      componentId: args.componentId,
      locationId: args.locationId,
      quantity: args.quantity,
      reservedQty: 0,
      availableQty: args.quantity,
      minimumStock: args.minimumStock,
      maximumStock: args.maximumStock,
      costPerUnit: args.costPerUnit,
      status,
      lastCountedAt: undefined,
      lastCountedBy: undefined,
      updatedAt: Date.now(),
    });
  },
});

// ============================================================
// CONTRACT: api.inventory.stock.adjust
// Takes absolute newQuantity (contract) and computes delta internally.
// Also records an inventory transaction for audit trail.
// ============================================================
export const adjust = mutation({
  args: {
    inventoryId: v.id("inventory"),
    newQuantity: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.inventoryId);
    if (!record) throw new Error("Inventory record not found");

    if (args.newQuantity < 0) throw new Error("Quantity cannot be negative");

    const previousQty = record.quantity;
    const delta = args.newQuantity - previousQty;
    const newAvailable = args.newQuantity - record.reservedQty;
    const status = computeStatus(
      args.newQuantity,
      record.minimumStock ?? undefined,
      record.maximumStock ?? undefined
    );

    await ctx.db.patch(args.inventoryId, {
      quantity: args.newQuantity,
      availableQty: newAvailable,
      status,
      updatedAt: Date.now(),
    });

    // Record audit trail transaction
    await ctx.db.insert("inventoryTransactions", {
      type: "adjust",
      componentId: record.componentId,
      locationId: record.locationId,
      quantity: delta,
      previousQty,
      newQty: args.newQuantity,
      referenceType: "manual",
      reason: args.reason,
      performedBy: "dashboard",
      timestamp: Date.now(),
    });

    return { id: args.inventoryId, previousQty, newQty: args.newQuantity, status };
  },
});

// MCP/Agent: delta-based adjustment (original function)
export const adjustQuantity = mutation({
  args: {
    id: v.id("inventory"),
    quantityDelta: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.id);
    if (!record) throw new Error("Inventory record not found");

    const newQty = record.quantity + args.quantityDelta;
    if (newQty < 0) throw new Error(`Cannot reduce stock below 0. Current: ${record.quantity}, delta: ${args.quantityDelta}`);

    const newAvailable = newQty - record.reservedQty;
    const status = computeStatus(newQty, record.minimumStock ?? undefined, record.maximumStock ?? undefined);

    await ctx.db.patch(args.id, {
      quantity: newQty,
      availableQty: newAvailable,
      status,
      updatedAt: Date.now(),
    });

    return { id: args.id, previousQty: record.quantity, newQty, status };
  },
});

export const reserveStock = mutation({
  args: {
    id: v.id("inventory"),
    reserveQty: v.number(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.id);
    if (!record) throw new Error("Inventory record not found");

    if (args.reserveQty > record.availableQty) {
      throw new Error(
        `Insufficient available stock. Available: ${record.availableQty}, requested: ${args.reserveQty}`
      );
    }

    const newReserved = record.reservedQty + args.reserveQty;
    const newAvailable = record.quantity - newReserved;

    await ctx.db.patch(args.id, {
      reservedQty: newReserved,
      availableQty: newAvailable,
      updatedAt: Date.now(),
    });

    return { id: args.id, reserved: newReserved, available: newAvailable };
  },
});

export const releaseReservation = mutation({
  args: {
    id: v.id("inventory"),
    releaseQty: v.number(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.id);
    if (!record) throw new Error("Inventory record not found");

    const newReserved = Math.max(0, record.reservedQty - args.releaseQty);
    const newAvailable = record.quantity - newReserved;

    await ctx.db.patch(args.id, {
      reservedQty: newReserved,
      availableQty: newAvailable,
      updatedAt: Date.now(),
    });

    return { id: args.id, reserved: newReserved, available: newAvailable };
  },
});

export const recordCount = mutation({
  args: {
    id: v.id("inventory"),
    countedQty: v.number(),
    countedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db.get(args.id);
    if (!record) throw new Error("Inventory record not found");

    const status = computeStatus(args.countedQty, record.minimumStock ?? undefined, record.maximumStock ?? undefined);
    const discrepancy = args.countedQty - record.quantity;

    await ctx.db.patch(args.id, {
      quantity: args.countedQty,
      availableQty: args.countedQty - record.reservedQty,
      status,
      lastCountedAt: Date.now(),
      lastCountedBy: args.countedBy,
      updatedAt: Date.now(),
    });

    return {
      id: args.id,
      previousQty: record.quantity,
      countedQty: args.countedQty,
      discrepancy,
      status,
    };
  },
});

export const lowStockReport = query({
  handler: async (ctx) => {
    const lowStock = await ctx.db
      .query("inventory")
      .withIndex("by_status", (q) => q.eq("status", "low_stock"))
      .collect();

    const outOfStock = await ctx.db
      .query("inventory")
      .withIndex("by_status", (q) => q.eq("status", "out_of_stock"))
      .collect();

    const all = [...outOfStock, ...lowStock];

    return await Promise.all(
      all.map(async (inv) => {
        const component = await ctx.db.get(inv.componentId);
        const location = await ctx.db.get(inv.locationId);
        return {
          ...inv,
          componentName: component?.name ?? "Unknown",
          partNumber: component?.partNumber ?? "Unknown",
          locationCode: location?.code ?? "Unknown",
        };
      })
    );
  },
});
