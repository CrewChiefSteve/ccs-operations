import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

// ============================================================
// INVENTORY TRANSACTIONS — Append-Only Audit Trail
// ============================================================

export const list = query({
  args: {
    componentId: v.optional(v.id("components")),
    locationId: v.optional(v.id("locations")),
    type: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.componentId) {
      return await ctx.db
        .query("inventoryTransactions")
        .withIndex("by_component", (q) => q.eq("componentId", args.componentId!))
        .order("desc")
        .take(args.limit ?? 50);
    }
    if (args.locationId) {
      return await ctx.db
        .query("inventoryTransactions")
        .withIndex("by_location", (q) => q.eq("locationId", args.locationId!))
        .order("desc")
        .take(args.limit ?? 50);
    }
    if (args.type) {
      return await ctx.db
        .query("inventoryTransactions")
        .withIndex("by_type", (q) => q.eq("type", args.type!))
        .order("desc")
        .take(args.limit ?? 50);
    }
    return await ctx.db
      .query("inventoryTransactions")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const listEnriched = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const txns = await ctx.db
      .query("inventoryTransactions")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit ?? 50);

    return await Promise.all(
      txns.map(async (txn) => {
        const component = await ctx.db.get(txn.componentId);
        const location = await ctx.db.get(txn.locationId);
        const toLocation = txn.toLocationId ? await ctx.db.get(txn.toLocationId) : null;
        return {
          ...txn,
          componentName: component?.name ?? "Unknown",
          partNumber: component?.partNumber ?? "Unknown",
          locationCode: location?.code ?? "Unknown",
          toLocationCode: toLocation?.code ?? undefined,
        };
      })
    );
  },
});

// Record a transaction (core function used by other operations)
export const record = mutation({
  args: {
    type: v.string(),
    componentId: v.id("components"),
    locationId: v.id("locations"),
    quantity: v.number(),
    referenceType: v.optional(v.string()),
    referenceId: v.optional(v.string()),
    toLocationId: v.optional(v.id("locations")),
    performedBy: v.optional(v.string()),
    verifiedBy: v.optional(v.string()),
    reason: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get current inventory record
    const invRecord = await ctx.db
      .query("inventory")
      .withIndex("by_component_location", (q) =>
        q.eq("componentId", args.componentId).eq("locationId", args.locationId)
      )
      .unique();

    const previousQty = invRecord?.quantity ?? 0;
    const newQty = previousQty + args.quantity;

    if (newQty < 0) {
      throw new Error(`Transaction would result in negative stock (${newQty}). Current: ${previousQty}, delta: ${args.quantity}`);
    }

    // Record the transaction
    const txnId = await ctx.db.insert("inventoryTransactions", {
      type: args.type,
      componentId: args.componentId,
      locationId: args.locationId,
      quantity: args.quantity,
      previousQty,
      newQty,
      referenceType: args.referenceType,
      referenceId: args.referenceId,
      toLocationId: args.toLocationId,
      performedBy: args.performedBy,
      verifiedBy: args.verifiedBy,
      reason: args.reason,
      notes: args.notes,
      timestamp: Date.now(),
    });

    return { transactionId: txnId, previousQty, newQty };
  },
});

// Get transaction history by reference (e.g., all transactions for a PO)
export const getByReference = query({
  args: {
    referenceType: v.string(),
    referenceId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("inventoryTransactions")
      .withIndex("by_reference", (q) =>
        q.eq("referenceType", args.referenceType).eq("referenceId", args.referenceId)
      )
      .collect();
  },
});
