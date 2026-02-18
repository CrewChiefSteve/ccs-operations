import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

// ============================================================
// BOM ENTRIES — Bill of Materials Management
// ============================================================

const PRODUCTS = [
  "Oil_Heater_Controller",
  "RaceScale",
  "Ride_Height_Sensor",
  "Tire_Temperature",
  "Tire-Temp-Probe",
] as const;

export const listByProduct = query({
  args: { productName: v.string() },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("bomEntries")
      .withIndex("by_product", (q) => q.eq("productName", args.productName))
      .collect();

    return await Promise.all(
      entries.map(async (entry) => {
        const component = await ctx.db.get(entry.componentId);
        return {
          ...entry,
          componentName: component?.name ?? "Unknown",
          partNumber: component?.partNumber ?? "Unknown",
          category: component?.category,
        };
      })
    );
  },
});

export const listByComponent = query({
  args: { componentId: v.id("components") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bomEntries")
      .withIndex("by_component", (q) => q.eq("componentId", args.componentId))
      .collect();
  },
});

export const create = mutation({
  args: {
    productName: v.string(),
    componentId: v.id("components"),
    quantityPerUnit: v.number(),
    referenceDesignator: v.optional(v.string()),
    placement: v.optional(v.string()),
    isOptional: v.optional(v.boolean()),
    substituteComponentIds: v.optional(v.array(v.id("components"))),
    notes: v.optional(v.string()),
    bomVersion: v.optional(v.string()),
    driveFileId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check for existing entry
    const existing = await ctx.db
      .query("bomEntries")
      .withIndex("by_product_component", (q) =>
        q.eq("productName", args.productName).eq("componentId", args.componentId)
      )
      .unique();

    if (existing) {
      throw new Error(`Component already exists in ${args.productName} BOM. Use update instead.`);
    }

    return await ctx.db.insert("bomEntries", {
      ...args,
      isOptional: args.isOptional ?? false,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("bomEntries"),
    quantityPerUnit: v.optional(v.number()),
    referenceDesignator: v.optional(v.string()),
    placement: v.optional(v.string()),
    isOptional: v.optional(v.boolean()),
    substituteComponentIds: v.optional(v.array(v.id("components"))),
    notes: v.optional(v.string()),
    bomVersion: v.optional(v.string()),
    driveFileId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("BOM entry not found");

    const cleanUpdates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) cleanUpdates[key] = value;
    }

    await ctx.db.patch(id, cleanUpdates);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("bomEntries") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return args.id;
  },
});

// BOM feasibility check: can we build N units of a product?
export const checkFeasibility = query({
  args: {
    productName: v.string(),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const bomEntries = await ctx.db
      .query("bomEntries")
      .withIndex("by_product", (q) => q.eq("productName", args.productName))
      .collect();

    if (bomEntries.length === 0) {
      return { feasible: false, reason: `No BOM found for ${args.productName}`, items: [] };
    }

    const items = await Promise.all(
      bomEntries.map(async (entry) => {
        const component = await ctx.db.get(entry.componentId);
        const inventoryRecords = await ctx.db
          .query("inventory")
          .withIndex("by_component", (q) => q.eq("componentId", entry.componentId))
          .collect();

        const totalAvailable = inventoryRecords.reduce((sum, r) => sum + r.availableQty, 0);
        const required = entry.quantityPerUnit * args.quantity;
        const shortage = Math.max(0, required - totalAvailable);

        return {
          componentId: entry.componentId,
          componentName: component?.name ?? "Unknown",
          partNumber: component?.partNumber ?? "Unknown",
          quantityPerUnit: entry.quantityPerUnit,
          totalRequired: required,
          totalAvailable,
          shortage,
          isOptional: entry.isOptional,
          sufficient: totalAvailable >= required,
        };
      })
    );

    const requiredShortages = items.filter((i) => !i.isOptional && !i.sufficient);
    const feasible = requiredShortages.length === 0;

    return {
      feasible,
      productName: args.productName,
      buildQuantity: args.quantity,
      totalComponents: items.length,
      shortages: requiredShortages.length,
      reason: feasible
        ? `Can build ${args.quantity} units of ${args.productName}`
        : `Missing ${requiredShortages.length} required components`,
      items,
    };
  },
});

// List all products with BOM entry counts
export const productSummary = query({
  handler: async (ctx) => {
    const all = await ctx.db.query("bomEntries").collect();
    const byProduct: Record<string, number> = {};

    for (const entry of all) {
      byProduct[entry.productName] = (byProduct[entry.productName] ?? 0) + 1;
    }

    return Object.entries(byProduct).map(([name, count]) => ({
      productName: name,
      componentCount: count,
    }));
  },
});
