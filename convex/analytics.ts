import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ============================================================
// ANALYTICS — Historical Aggregation Queries
// ============================================================
// Provides time-series and trend data for the analytics dashboard.
// All queries read existing tables — no new schema required.
// ============================================================

// ============================================================
// SPEND BY PERIOD — PO spend grouped by time bucket
// ============================================================
export const getSpendByPeriod = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    groupBy: v.optional(v.string()), // "day" | "week" | "month"
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const start = args.startDate ?? now - 180 * 86400000; // default 6 months
    const end = args.endDate ?? now;
    const groupBy = args.groupBy ?? "month";

    const pos = await ctx.db.query("purchaseOrders").collect();

    // Filter to received/shipped POs within date range (use orderDate)
    const relevant = pos.filter(
      (po) =>
        po.orderDate &&
        po.orderDate >= start &&
        po.orderDate <= end &&
        po.totalCost &&
        po.totalCost > 0
    );

    // Group by time bucket
    const buckets = new Map<string, { label: string; total: number; count: number }>();

    for (const po of relevant) {
      const d = new Date(po.orderDate!);
      let key: string;
      let label: string;

      if (groupBy === "day") {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        label = key;
      } else if (groupBy === "week") {
        // Week start (Monday)
        const dayOfWeek = d.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(d);
        monday.setDate(d.getDate() + mondayOffset);
        key = `${monday.getFullYear()}-W${String(Math.ceil((monday.getDate() + new Date(monday.getFullYear(), monday.getMonth(), 1).getDay()) / 7)).padStart(2, "0")}`;
        label = `Week of ${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      } else {
        // month
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      }

      const bucket = buckets.get(key) ?? { label, total: 0, count: 0 };
      bucket.total += po.totalCost ?? 0;
      bucket.count += 1;
      buckets.set(key, bucket);
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => ({
        period: key,
        label: data.label,
        total: Math.round(data.total * 100) / 100,
        orderCount: data.count,
      }));
  },
});

// ============================================================
// BURN RATE — Component consumption from transactions
// ============================================================
export const getBurnRate = query({
  args: {
    period: v.optional(v.string()), // "30d" | "90d" | "all"
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const periodMs =
      args.period === "all"
        ? now
        : args.period === "90d"
          ? 90 * 86400000
          : 30 * 86400000;

    const cutoff = now - periodMs;

    // Get consume transactions within period
    const txns = await ctx.db
      .query("inventoryTransactions")
      .withIndex("by_type", (q) => q.eq("type", "consume"))
      .collect();

    const filtered = txns.filter((t) => t.timestamp >= cutoff);

    // Aggregate by component
    const componentUsage = new Map<string, { componentId: string; totalConsumed: number }>();

    for (const txn of filtered) {
      const existing = componentUsage.get(txn.componentId) ?? {
        componentId: txn.componentId,
        totalConsumed: 0,
      };
      existing.totalConsumed += Math.abs(txn.quantity);
      componentUsage.set(txn.componentId, existing);
    }

    // Sort by total consumed, enrich with component name
    const sorted = Array.from(componentUsage.values())
      .sort((a, b) => b.totalConsumed - a.totalConsumed)
      .slice(0, args.limit ?? 15);

    const enriched = await Promise.all(
      sorted.map(async (item) => {
        const component = await ctx.db.get(item.componentId as Id<"components">);
        return {
          componentId: item.componentId,
          componentName: component?.name ?? "Unknown",
          partNumber: component?.partNumber ?? "Unknown",
          totalConsumed: item.totalConsumed,
          avgPerDay: Math.round((item.totalConsumed / (periodMs / 86400000)) * 100) / 100,
        };
      })
    );

    return enriched;
  },
});

// ============================================================
// LEAD TIME ANALYSIS — Expected vs actual delivery per supplier
// ============================================================
export const getLeadTimeAnalysis = query({
  args: {
    supplierId: v.optional(v.id("suppliers")),
  },
  handler: async (ctx, args) => {
    const pos = await ctx.db.query("purchaseOrders").collect();

    // Filter to received POs with both expected and actual delivery dates
    const received = pos.filter(
      (po) =>
        po.status === "received" &&
        po.expectedDelivery &&
        po.actualDelivery &&
        (!args.supplierId || po.supplierId === args.supplierId)
    );

    // Aggregate by supplier
    const supplierStats = new Map<
      string,
      {
        supplierId: string;
        totalOrders: number;
        totalExpectedDays: number;
        totalActualDays: number;
        onTimeCount: number;
        lateCount: number;
      }
    >();

    for (const po of received) {
      const suppId = po.supplierId;
      const expectedDays = Math.max(
        1,
        Math.round((po.expectedDelivery! - (po.orderDate ?? po._creationTime)) / 86400000)
      );
      const actualDays = Math.max(
        1,
        Math.round((po.actualDelivery! - (po.orderDate ?? po._creationTime)) / 86400000)
      );
      const onTime = po.actualDelivery! <= po.expectedDelivery!;

      const existing = supplierStats.get(suppId) ?? {
        supplierId: suppId,
        totalOrders: 0,
        totalExpectedDays: 0,
        totalActualDays: 0,
        onTimeCount: 0,
        lateCount: 0,
      };

      existing.totalOrders += 1;
      existing.totalExpectedDays += expectedDays;
      existing.totalActualDays += actualDays;
      if (onTime) existing.onTimeCount += 1;
      else existing.lateCount += 1;

      supplierStats.set(suppId, existing);
    }

    const enriched = await Promise.all(
      Array.from(supplierStats.values()).map(async (stats) => {
        const supplier = await ctx.db.get(stats.supplierId as Id<"suppliers">);
        return {
          supplierId: stats.supplierId,
          supplierName: supplier?.name ?? "Unknown",
          totalOrders: stats.totalOrders,
          avgExpectedDays: Math.round(stats.totalExpectedDays / stats.totalOrders),
          avgActualDays: Math.round(stats.totalActualDays / stats.totalOrders),
          onTimePercent: Math.round((stats.onTimeCount / stats.totalOrders) * 100),
          onTimeCount: stats.onTimeCount,
          lateCount: stats.lateCount,
        };
      })
    );

    return enriched.sort((a, b) => b.totalOrders - a.totalOrders);
  },
});

// ============================================================
// INVENTORY VALUE OVER TIME — Approximated from transactions
// ============================================================
export const getInventoryValueHistory = query({
  args: {
    period: v.optional(v.string()), // "30d" | "90d" | "180d"
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const periodMs =
      args.period === "180d"
        ? 180 * 86400000
        : args.period === "90d"
          ? 90 * 86400000
          : 30 * 86400000;

    const cutoff = now - periodMs;

    // Get current inventory value as the endpoint
    const inventory = await ctx.db.query("inventory").collect();
    let currentValue = 0;
    for (const inv of inventory) {
      if (inv.costPerUnit) {
        currentValue += inv.quantity * inv.costPerUnit;
      }
    }

    // Get all receive and consume transactions to build timeline
    const txns = await ctx.db
      .query("inventoryTransactions")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();

    const relevantTxns = txns.filter((t) => t.timestamp >= cutoff);

    // Build daily snapshots by working backward from current value
    const dayBuckets = new Map<string, number>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Set current day
    const todayKey = formatDateKey(today);
    dayBuckets.set(todayKey, currentValue);

    // Walk backward through transactions, adjusting value
    let runningValue = currentValue;
    const sortedTxns = relevantTxns.sort((a, b) => b.timestamp - a.timestamp);

    for (const txn of sortedTxns) {
      const d = new Date(txn.timestamp);
      d.setHours(0, 0, 0, 0);
      const key = formatDateKey(d);

      // Look up cost for this component
      const invRecord = await ctx.db
        .query("inventory")
        .withIndex("by_component", (q) => q.eq("componentId", txn.componentId))
        .first();

      const costPerUnit = invRecord?.costPerUnit ?? 0;
      const valueDelta = txn.quantity * costPerUnit;

      // Reverse the transaction to get prior value
      runningValue -= valueDelta;

      if (!dayBuckets.has(key)) {
        dayBuckets.set(key, Math.max(0, runningValue));
      }
    }

    // Fill gaps with last known value (forward fill)
    const result: Array<{ date: string; label: string; value: number }> = [];
    const startDate = new Date(cutoff);
    startDate.setHours(0, 0, 0, 0);

    let lastValue = 0;
    const iter = new Date(startDate);
    while (iter <= today) {
      const key = formatDateKey(iter);
      if (dayBuckets.has(key)) {
        lastValue = dayBuckets.get(key)!;
      }
      result.push({
        date: key,
        label: iter.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: Math.round(lastValue * 100) / 100,
      });
      iter.setDate(iter.getDate() + 1);
    }

    // Downsample if too many points (keep ~30 points max)
    if (result.length > 30) {
      const step = Math.ceil(result.length / 30);
      return result.filter((_, i) => i % step === 0 || i === result.length - 1);
    }

    return result;
  },
});

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ============================================================
// COST TRENDS — COGS per unit over time from productCosts
// ============================================================
export const getCostTrends = query({
  args: {
    productName: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let costs;
    if (args.productName) {
      costs = await ctx.db
        .query("productCosts")
        .withIndex("by_product", (q) => q.eq("productName", args.productName!))
        .order("asc")
        .take(args.limit ?? 50);
    } else {
      costs = await ctx.db
        .query("productCosts")
        .withIndex("by_calculatedAt")
        .order("asc")
        .take(args.limit ?? 100);
    }

    return costs.map((c) => ({
      productName: c.productName,
      costPerUnit: c.costPerUnit,
      materialCost: c.materialCost,
      laborCost: c.laborCost ?? 0,
      overheadCost: c.overheadCost ?? 0,
      type: c.type,
      calculatedAt: c.calculatedAt,
      label: new Date(c.calculatedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    }));
  },
});

// ============================================================
// SUPPLIER PERFORMANCE — Aggregated metrics per supplier
// ============================================================
export const getSupplierPerformance = query({
  handler: async (ctx) => {
    const suppliers = await ctx.db.query("suppliers").collect();
    const pos = await ctx.db.query("purchaseOrders").collect();

    const result = await Promise.all(
      suppliers
        .filter((s) => s.status !== "inactive")
        .map(async (supplier) => {
          const supplierPOs = pos.filter((po) => po.supplierId === supplier._id);
          const receivedPOs = supplierPOs.filter((po) => po.status === "received");

          // Total spend
          const totalSpend = supplierPOs.reduce(
            (sum, po) => sum + (po.totalCost ?? 0),
            0
          );

          // On-time delivery
          const withDeliveryData = receivedPOs.filter(
            (po) => po.expectedDelivery && po.actualDelivery
          );
          const onTimeCount = withDeliveryData.filter(
            (po) => po.actualDelivery! <= po.expectedDelivery!
          ).length;

          // Average lead time
          const leadTimes = receivedPOs
            .filter((po) => po.orderDate && po.actualDelivery)
            .map((po) =>
              Math.round((po.actualDelivery! - po.orderDate!) / 86400000)
            );

          const avgLeadTime =
            leadTimes.length > 0
              ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length)
              : supplier.leadTimeDays ?? null;

          return {
            supplierId: supplier._id,
            supplierName: supplier.name,
            supplierCode: supplier.code,
            rating: supplier.rating,
            totalOrders: supplierPOs.length,
            completedOrders: receivedPOs.length,
            totalSpend: Math.round(totalSpend * 100) / 100,
            onTimePercent:
              withDeliveryData.length > 0
                ? Math.round((onTimeCount / withDeliveryData.length) * 100)
                : null,
            avgLeadTimeDays: avgLeadTime,
          };
        })
    );

    return result
      .filter((r) => r.totalOrders > 0)
      .sort((a, b) => b.totalSpend - a.totalSpend);
  },
});

// ============================================================
// SUMMARY STATS — Quick numbers for StatCards
// ============================================================
export const getSummaryStats = query({
  handler: async (ctx) => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 86400000;

    // 30-day spend
    const pos = await ctx.db.query("purchaseOrders").collect();
    const recentPOs = pos.filter(
      (po) =>
        po.orderDate &&
        po.orderDate >= thirtyDaysAgo &&
        po.totalCost &&
        po.totalCost > 0
    );
    const spend30d = recentPOs.reduce(
      (sum, po) => sum + (po.totalCost ?? 0),
      0
    );

    // Avg lead time (from received POs)
    const receivedPOs = pos.filter(
      (po) =>
        po.status === "received" &&
        po.orderDate &&
        po.actualDelivery
    );
    const leadTimes = receivedPOs.map((po) =>
      Math.round((po.actualDelivery! - po.orderDate!) / 86400000)
    );
    const avgLeadTime =
      leadTimes.length > 0
        ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length)
        : null;

    // Total transaction volume (30d)
    const txns = await ctx.db
      .query("inventoryTransactions")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();
    const recentTxns = txns.filter((t) => t.timestamp >= thirtyDaysAgo);

    return {
      spend30d: Math.round(spend30d * 100) / 100,
      avgLeadTimeDays: avgLeadTime,
      transactionCount30d: recentTxns.length,
      poCount30d: recentPOs.length,
    };
  },
});
