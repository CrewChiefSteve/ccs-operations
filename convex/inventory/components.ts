import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

// ============================================================
// COMPONENTS — Part Catalog CRUD
// ============================================================

export const list = query({
  args: {
    category: v.optional(v.string()),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("components");

    if (args.category) {
      q = ctx.db.query("components").withIndex("by_category", (q) =>
        q.eq("category", args.category!)
      );
    } else if (args.status) {
      q = ctx.db.query("components").withIndex("by_status", (q) =>
        q.eq("status", args.status!)
      );
    }

    const results = await q.order("desc").take(args.limit ?? 100);
    return results;
  },
});

export const getByPartNumber = query({
  args: { partNumber: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("components")
      .withIndex("by_partNumber", (q) => q.eq("partNumber", args.partNumber))
      .unique();
  },
});

export const getById = query({
  args: { id: v.id("components") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const search = query({
  args: {
    searchTerm: v.string(),
    category: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("components")
      .withSearchIndex("search_components", (q) => {
        let search = q.search("name", args.searchTerm);
        if (args.category) search = search.eq("category", args.category);
        if (args.status) search = search.eq("status", args.status);
        return search;
      });

    return await q.take(25);
  },
});

export const create = mutation({
  args: {
    partNumber: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    subcategory: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    manufacturerPartNumber: v.optional(v.string()),
    specs: v.optional(v.object({
      package: v.optional(v.string()),
      value: v.optional(v.string()),
      voltage: v.optional(v.string()),
      current: v.optional(v.string()),
      tolerance: v.optional(v.string()),
      temperature: v.optional(v.string()),
      custom: v.optional(v.any()),
    })),
    datasheetUrl: v.optional(v.string()),
    datasheetDriveFileId: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.optional(v.string()),
    usedInProducts: v.optional(v.array(v.string())),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check for duplicate part number
    const existing = await ctx.db
      .query("components")
      .withIndex("by_partNumber", (q) => q.eq("partNumber", args.partNumber))
      .unique();

    if (existing) {
      throw new Error(`Component with part number ${args.partNumber} already exists`);
    }

    return await ctx.db.insert("components", {
      ...args,
      status: args.status ?? "active",
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("components"),
    partNumber: v.optional(v.string()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    subcategory: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    manufacturerPartNumber: v.optional(v.string()),
    specs: v.optional(v.object({
      package: v.optional(v.string()),
      value: v.optional(v.string()),
      voltage: v.optional(v.string()),
      current: v.optional(v.string()),
      tolerance: v.optional(v.string()),
      temperature: v.optional(v.string()),
      custom: v.optional(v.any()),
    })),
    datasheetUrl: v.optional(v.string()),
    datasheetDriveFileId: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.optional(v.string()),
    usedInProducts: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Component not found");

    // If changing part number, check uniqueness
    if (updates.partNumber && updates.partNumber !== existing.partNumber) {
      const dup = await ctx.db
        .query("components")
        .withIndex("by_partNumber", (q) => q.eq("partNumber", updates.partNumber!))
        .unique();
      if (dup) throw new Error(`Part number ${updates.partNumber} already in use`);
    }

    // Filter out undefined values
    const cleanUpdates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) cleanUpdates[key] = value;
    }

    await ctx.db.patch(id, cleanUpdates);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("components") },
  handler: async (ctx, args) => {
    // Check for dependencies before deletion
    const inventoryRefs = await ctx.db
      .query("inventory")
      .withIndex("by_component", (q) => q.eq("componentId", args.id))
      .take(1);

    if (inventoryRefs.length > 0) {
      throw new Error("Cannot delete component with inventory records. Set status to 'deprecated' instead.");
    }

    const bomRefs = await ctx.db
      .query("bomEntries")
      .withIndex("by_component", (q) => q.eq("componentId", args.id))
      .take(1);

    if (bomRefs.length > 0) {
      throw new Error("Cannot delete component referenced in BOMs. Set status to 'deprecated' instead.");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});

// Aggregate stats
export const stats = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("components").collect();
    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = {};

    for (const c of all) {
      byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
      byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;
    }

    return {
      total: all.length,
      byCategory,
      byStatus,
    };
  },
});
