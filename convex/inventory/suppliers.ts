import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

// ============================================================
// SUPPLIERS — Vendor Directory CRUD
// ============================================================
// Dashboard contract: api.inventory.suppliers.list / .create
// ============================================================

export const list = query({
  args: {
    search: v.optional(v.string()),   // Dashboard contract field
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Search via search index if available
    if (args.search && args.search.trim().length > 0) {
      const results = await ctx.db
        .query("suppliers")
        .withSearchIndex("search_suppliers", (q) => {
          let search = q.search("name", args.search!);
          if (args.status) search = search.eq("status", args.status);
          return search;
        })
        .take(50);

      // Enrich with component count
      return await Promise.all(
        results.map(async (s) => {
          const links = await ctx.db
            .query("componentSuppliers")
            .withIndex("by_supplier", (q) => q.eq("supplierId", s._id))
            .collect();
          return { ...s, componentCount: links.length };
        })
      );
    }

    // Filtered by status
    let suppliers;
    if (args.status) {
      suppliers = await ctx.db
        .query("suppliers")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else {
      suppliers = await ctx.db.query("suppliers").order("desc").collect();
    }

    // Enrich with component count
    return await Promise.all(
      suppliers.map(async (s) => {
        const links = await ctx.db
          .query("componentSuppliers")
          .withIndex("by_supplier", (q) => q.eq("supplierId", s._id))
          .collect();
        return { ...s, componentCount: links.length };
      })
    );
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
    code: v.optional(v.string()),        // Optional now — auto-generates if not provided
    website: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    contactName: v.optional(v.string()),  // Dashboard contract field
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    notes: v.optional(v.string()),
    rating: v.optional(v.number()),       // Dashboard contract field (1-5)
    leadTimeDays: v.optional(v.number()),
    shippingNotes: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Auto-generate code from name if not provided
    const code = args.code ?? args.name
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 6)
      .toUpperCase();

    // Check uniqueness
    const existing = await ctx.db
      .query("suppliers")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();

    // If auto-generated code conflicts, append a number
    let finalCode = code;
    if (existing) {
      if (args.code) {
        // User explicitly provided a duplicate code
        throw new Error(`Supplier with code "${code}" already exists`);
      }
      // Auto-generated conflict: append timestamp suffix
      finalCode = `${code}${Date.now().toString(36).slice(-3).toUpperCase()}`;
    }

    return await ctx.db.insert("suppliers", {
      name: args.name,
      code: finalCode,
      website: args.website,
      accountNumber: args.accountNumber,
      contactName: args.contactName,
      contactEmail: args.contactEmail,
      contactPhone: args.contactPhone,
      notes: args.notes,
      rating: args.rating,
      leadTimeDays: args.leadTimeDays,
      shippingNotes: args.shippingNotes,
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
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    notes: v.optional(v.string()),
    rating: v.optional(v.number()),
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
