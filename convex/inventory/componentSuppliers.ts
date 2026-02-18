import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

// ============================================================
// COMPONENT SUPPLIERS — Pricing & Availability Junction
// ============================================================

export const listByComponent = query({
  args: { componentId: v.id("components") },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("componentSuppliers")
      .withIndex("by_component", (q) => q.eq("componentId", args.componentId))
      .collect();

    return await Promise.all(
      records.map(async (r) => {
        const supplier = await ctx.db.get(r.supplierId);
        return { ...r, supplierName: supplier?.name ?? "Unknown", supplierCode: supplier?.code ?? "Unknown" };
      })
    );
  },
});

export const listBySupplier = query({
  args: { supplierId: v.id("suppliers") },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("componentSuppliers")
      .withIndex("by_supplier", (q) => q.eq("supplierId", args.supplierId))
      .collect();

    return await Promise.all(
      records.map(async (r) => {
        const component = await ctx.db.get(r.componentId);
        return { ...r, componentName: component?.name ?? "Unknown", partNumber: component?.partNumber ?? "Unknown" };
      })
    );
  },
});

export const create = mutation({
  args: {
    componentId: v.id("components"),
    supplierId: v.id("suppliers"),
    supplierPartNumber: v.optional(v.string()),
    unitPrice: v.optional(v.number()),
    currency: v.optional(v.string()),
    minOrderQty: v.optional(v.number()),
    leadTimeDays: v.optional(v.number()),
    url: v.optional(v.string()),
    inStock: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    isPreferred: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("componentSuppliers")
      .withIndex("by_component_supplier", (q) =>
        q.eq("componentId", args.componentId).eq("supplierId", args.supplierId)
      )
      .unique();

    if (existing) throw new Error("This component-supplier relationship already exists");

    return await ctx.db.insert("componentSuppliers", {
      ...args,
      currency: args.currency ?? "USD",
      isPreferred: args.isPreferred ?? false,
      lastPriceCheck: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("componentSuppliers"),
    supplierPartNumber: v.optional(v.string()),
    unitPrice: v.optional(v.number()),
    currency: v.optional(v.string()),
    minOrderQty: v.optional(v.number()),
    leadTimeDays: v.optional(v.number()),
    url: v.optional(v.string()),
    inStock: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    isPreferred: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const cleanUpdates: Record<string, unknown> = { updatedAt: Date.now(), lastPriceCheck: Date.now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) cleanUpdates[key] = value;
    }
    await ctx.db.patch(id, cleanUpdates);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("componentSuppliers") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});
