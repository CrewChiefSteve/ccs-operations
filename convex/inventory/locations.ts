import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

// ============================================================
// LOCATIONS — Hierarchical Warehouse Locations
// ============================================================

export const list = query({
  args: { type: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (args.type) {
      return await ctx.db
        .query("locations")
        .withIndex("by_type", (q) => q.eq("type", args.type!))
        .collect();
    }
    return await ctx.db.query("locations").collect();
  },
});

export const getById = query({
  args: { id: v.id("locations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("locations")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();
  },
});

export const getChildren = query({
  args: { parentId: v.id("locations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("locations")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .collect();
  },
});

// Get full tree from root locations
export const getTree = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("locations").collect();
    const roots = all.filter((l) => !l.parentId);
    
    function buildTree(parentId: string | undefined): any[] {
      return all
        .filter((l) => (l.parentId as any)?._id === parentId || String(l.parentId) === parentId)
        .map((l) => ({
          ...l,
          children: buildTree(l._id as any),
        }));
    }

    // Simple approach: roots + their direct children grouped
    const byParent: Record<string, typeof all> = {};
    for (const loc of all) {
      const key = loc.parentId ? String(loc.parentId) : "root";
      if (!byParent[key]) byParent[key] = [];
      byParent[key].push(loc);
    }

    return { locations: all, roots, byParent };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    code: v.string(),
    type: v.string(),
    parentId: v.optional(v.id("locations")),
    description: v.optional(v.string()),
    capacity: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("locations")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique();

    if (existing) throw new Error(`Location code "${args.code}" already exists`);

    if (args.parentId) {
      const parent = await ctx.db.get(args.parentId);
      if (!parent) throw new Error("Parent location not found");
    }

    return await ctx.db.insert("locations", {
      ...args,
      status: args.status ?? "active",
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("locations"),
    name: v.optional(v.string()),
    code: v.optional(v.string()),
    type: v.optional(v.string()),
    parentId: v.optional(v.id("locations")),
    description: v.optional(v.string()),
    capacity: v.optional(v.number()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Location not found");

    if (updates.code && updates.code !== existing.code) {
      const dup = await ctx.db
        .query("locations")
        .withIndex("by_code", (q) => q.eq("code", updates.code!))
        .unique();
      if (dup) throw new Error(`Location code "${updates.code}" already in use`);
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
  args: { id: v.id("locations") },
  handler: async (ctx, args) => {
    const inventoryRefs = await ctx.db
      .query("inventory")
      .withIndex("by_location", (q) => q.eq("locationId", args.id))
      .take(1);

    if (inventoryRefs.length > 0) {
      throw new Error("Cannot delete location with inventory. Move stock first.");
    }

    const children = await ctx.db
      .query("locations")
      .withIndex("by_parent", (q) => q.eq("parentId", args.id))
      .take(1);

    if (children.length > 0) {
      throw new Error("Cannot delete location with children. Remove or reparent child locations first.");
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});
