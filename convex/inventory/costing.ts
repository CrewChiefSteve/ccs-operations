import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// ============================================================
// COST TRACKING & COGS — Product cost estimation and tracking
// ============================================================
// COGS = Cost of Goods Sold
// Calculates material costs from BOM × component unit costs.
// Cost sources (priority order):
//   1. Latest PO line price for this component
//   2. Inventory costPerUnit (set during receiving)
//   3. Preferred supplier unitPrice
//   4. Any supplier unitPrice
//   5. Zero (unknown cost)
// ============================================================

// ----------------------------------------------------------
// QUERY: Calculate COGS estimate for a product
// ----------------------------------------------------------
export const calculateProductCOGS = query({
  args: {
    productName: v.string(),
    quantity: v.optional(v.number()),
    bomVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const quantity = args.quantity ?? 1;

    // Get BOM entries
    const bomEntries = await ctx.db
      .query("bomEntries")
      .withIndex("by_product", (q) => q.eq("productName", args.productName))
      .collect();

    const filtered = args.bomVersion
      ? bomEntries.filter((e) => e.bomVersion === args.bomVersion)
      : bomEntries;

    if (filtered.length === 0) {
      return {
        productName: args.productName,
        quantity,
        lineItems: [],
        materialCost: 0,
        costPerUnit: 0,
        bomVersion: args.bomVersion,
        hasUnknownCosts: false,
      };
    }

    const lineItems: Array<{
      componentId: Id<"components">;
      componentName: string;
      partNumber: string;
      quantityPerUnit: number;
      unitCost: number;
      totalCost: number;
      source: string;
    }> = [];

    let hasUnknownCosts = false;

    for (const entry of filtered) {
      const component = await ctx.db.get(entry.componentId);
      if (!component) continue;

      // Find best cost source
      const { unitCost, source } = await findBestCost(
        ctx,
        entry.componentId
      );

      if (unitCost === 0) hasUnknownCosts = true;

      const totalCost = unitCost * entry.quantityPerUnit * quantity;

      lineItems.push({
        componentId: entry.componentId,
        componentName: component.name,
        partNumber: component.partNumber,
        quantityPerUnit: entry.quantityPerUnit,
        unitCost,
        totalCost,
        source,
      });
    }

    const materialCost = lineItems.reduce((sum, li) => sum + li.totalCost, 0);

    return {
      productName: args.productName,
      quantity,
      lineItems,
      materialCost,
      costPerUnit: quantity > 0 ? materialCost / quantity : 0,
      bomVersion: args.bomVersion,
      hasUnknownCosts,
    };
  },
});

// ----------------------------------------------------------
// MUTATION: Save a COGS snapshot
// ----------------------------------------------------------
export const saveCostSnapshot = mutation({
  args: {
    productName: v.string(),
    buildOrderId: v.optional(v.id("buildOrders")),
    type: v.union(v.literal("estimate"), v.literal("actual")),
    bomVersion: v.optional(v.string()),
    quantity: v.number(),
    materialCost: v.number(),
    laborCost: v.optional(v.number()),
    overheadCost: v.optional(v.number()),
    lineItems: v.array(v.object({
      componentId: v.id("components"),
      componentName: v.string(),
      partNumber: v.string(),
      quantityPerUnit: v.number(),
      unitCost: v.number(),
      totalCost: v.number(),
      source: v.string(),
    })),
    calculatedBy: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const labor = args.laborCost ?? 0;
    const overhead = args.overheadCost ?? 0;
    const totalCost = args.materialCost + labor + overhead;
    const costPerUnit = args.quantity > 0 ? totalCost / args.quantity : 0;

    return await ctx.db.insert("productCosts", {
      productName: args.productName,
      buildOrderId: args.buildOrderId,
      type: args.type,
      bomVersion: args.bomVersion,
      quantity: args.quantity,
      materialCost: args.materialCost,
      laborCost: args.laborCost,
      overheadCost: args.overheadCost,
      totalCost,
      costPerUnit,
      lineItems: args.lineItems,
      calculatedAt: Date.now(),
      calculatedBy: args.calculatedBy,
      notes: args.notes,
    });
  },
});

// ----------------------------------------------------------
// QUERY: Cost history for a product
// ----------------------------------------------------------
export const getProductCostHistory = query({
  args: {
    productName: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.productName) {
      return await ctx.db
        .query("productCosts")
        .withIndex("by_product", (q) => q.eq("productName", args.productName!))
        .order("desc")
        .take(args.limit ?? 20);
    }
    return await ctx.db
      .query("productCosts")
      .withIndex("by_calculatedAt")
      .order("desc")
      .take(args.limit ?? 20);
  },
});

// ----------------------------------------------------------
// QUERY: Latest COGS per product (for dashboard)
// ----------------------------------------------------------
export const getLatestCostPerProduct = query({
  handler: async (ctx) => {
    const allCosts = await ctx.db.query("productCosts").collect();

    // Group by product, get latest
    const latest = new Map<string, typeof allCosts[0]>();
    for (const cost of allCosts) {
      const existing = latest.get(cost.productName);
      if (!existing || cost.calculatedAt > existing.calculatedAt) {
        latest.set(cost.productName, cost);
      }
    }

    return Array.from(latest.values()).map((cost) => ({
      productName: cost.productName,
      type: cost.type,
      costPerUnit: cost.costPerUnit,
      materialCost: cost.materialCost,
      totalCost: cost.totalCost,
      calculatedAt: cost.calculatedAt,
      bomVersion: cost.bomVersion,
    }));
  },
});

// ----------------------------------------------------------
// HELPER: Find best unit cost for a component
// ----------------------------------------------------------
async function findBestCost(
  ctx: { db: any },
  componentId: Id<"components">
): Promise<{ unitCost: number; source: string }> {
  // 1. Latest PO line price
  const poLines = await ctx.db
    .query("purchaseOrderLines")
    .withIndex("by_component", (q: any) => q.eq("componentId", componentId))
    .order("desc")
    .take(1);

  if (poLines.length > 0 && poLines[0].unitPrice > 0) {
    return { unitCost: poLines[0].unitPrice, source: "po_last" };
  }

  // 2. Inventory costPerUnit
  const inventory = await ctx.db
    .query("inventory")
    .withIndex("by_component", (q: any) => q.eq("componentId", componentId))
    .collect();

  const withCost = inventory.find(
    (i: any) => i.costPerUnit && i.costPerUnit > 0
  );
  if (withCost) {
    return { unitCost: withCost.costPerUnit, source: "inventory_avg" };
  }

  // 3. Preferred supplier price
  const supplierLinks = await ctx.db
    .query("componentSuppliers")
    .withIndex("by_component", (q: any) => q.eq("componentId", componentId))
    .collect();

  const preferred = supplierLinks.find((s: any) => s.isPreferred && s.unitPrice > 0);
  if (preferred) {
    return { unitCost: preferred.unitPrice, source: "supplier_preferred" };
  }

  // 4. Any supplier price
  const anySuplier = supplierLinks.find((s: any) => s.unitPrice > 0);
  if (anySuplier) {
    return { unitCost: anySuplier.unitPrice, source: "supplier_price" };
  }

  // 5. Unknown
  return { unitCost: 0, source: "unknown" };
}
