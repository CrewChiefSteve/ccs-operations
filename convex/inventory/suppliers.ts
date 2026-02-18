import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

// ============================================================
// SUPPLIERS — Vendor Directory CRUD
// ============================================================

export const list = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("suppliers")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    }
    return await ctx.db.query("suppliers").order("desc").collect();
  },
});

export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("suppliers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();
  },
});

export const getById = query({
  args: { id: v.id("suppliers") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    website: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    notes: v.optional(v.string()),
    leadTimeDays: v.optional(v.number()),
    shippingNotes: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("suppliers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (existing) throw new Error(`Supplier with code "${args.code}" already exists`);

    return await ctx.db.insert("suppliers", {
      ...args,
      status: args.status ?? "active",
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("suppliers"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    website: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    notes: v.optional(v.string()),
    leadTimeDays: v.optional(v.number()),
    shippingNotes: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Supplier not found");

    if (updates.code && updates.code !== existing.code) {
      const dup = await ctx.db
        .query("suppliers")
        .withIndex("by_code", (q) => q.eq("code", updates.code!))
        .unique();
      if (dup) throw new Error(`Supplier code "${updates.code}" already in use`);
    }

    const cleanUpdates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) cleanUpdates[key] = value;
    }

    await ctx.db.patch(id, cleanUpdates);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("suppliers") },
  handler: async (ctx, args) => {
    const poRefs = await ctx.db
      .query("purchaseOrders")
      .withIndex("by_supplier", (q) => q.eq("supplierId", args.id))
      .take(1);

    if (poRefs.length > 0) {
      throw new Error("Cannot delete supplier with purchase orders. Set status to 'inactive' instead.");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});
