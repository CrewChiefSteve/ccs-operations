import { query } from "./_generated/server";

// ============================================================
// DASHBOARD — Aggregate Operational Overview
// ============================================================

export const overview = query({
  handler: async (ctx) => {
    // Component stats
    const components = await ctx.db.query("components").collect();
    const activeComponents = components.filter((c) => c.status === "active").length;

    // Inventory stats
    const inventory = await ctx.db.query("inventory").collect();
    const lowStock = inventory.filter((i) => i.status === "low_stock").length;
    const outOfStock = inventory.filter((i) => i.status === "out_of_stock").length;

    // PO stats
    const pos = await ctx.db.query("purchaseOrders").collect();
    const openPOs = pos.filter((po) =>
      ["draft", "submitted", "confirmed", "shipped", "partial_received"].includes(po.status)
    ).length;
    const overduePOs = pos.filter((po) =>
      po.expectedDelivery && po.expectedDelivery < Date.now() &&
      !["received", "cancelled"].includes(po.status)
    ).length;

    // Build order stats
    const builds = await ctx.db.query("buildOrders").collect();
    const activeBuilds = builds.filter((b) =>
      ["planned", "materials_reserved", "in_progress", "qc"].includes(b.status)
    ).length;

    // Alert stats
    const alerts = await ctx.db.query("alerts").collect();
    const activeAlerts = alerts.filter((a) => a.status === "active").length;
    const criticalAlerts = alerts.filter(
      (a) => a.status === "active" && a.severity === "critical"
    ).length;

    // Task stats
    const tasks = await ctx.db.query("tasks").collect();
    const pendingTasks = tasks.filter((t) =>
      ["pending", "assigned", "in_progress"].includes(t.status)
    ).length;
    const overdueTasks = tasks.filter((t) =>
      t.dueAt && t.dueAt < Date.now() &&
      !["completed", "verified", "cancelled"].includes(t.status)
    ).length;

    // Drive stats
    const driveFiles = await ctx.db.query("driveFiles").collect();
    const lastSync = await ctx.db
      .query("driveSyncLog")
      .withIndex("by_startedAt")
      .order("desc")
      .take(1);

    // Suppliers
    const suppliers = await ctx.db.query("suppliers").collect();

    return {
      components: {
        total: components.length,
        active: activeComponents,
      },
      inventory: {
        totalRecords: inventory.length,
        lowStock,
        outOfStock,
        healthy: inventory.length - lowStock - outOfStock,
      },
      purchaseOrders: {
        total: pos.length,
        open: openPOs,
        overdue: overduePOs,
      },
      buildOrders: {
        total: builds.length,
        active: activeBuilds,
      },
      alerts: {
        active: activeAlerts,
        critical: criticalAlerts,
      },
      tasks: {
        pending: pendingTasks,
        overdue: overdueTasks,
      },
      drive: {
        indexedFiles: driveFiles.length,
        lastSyncAt: lastSync[0]?.completedAt ?? null,
        lastSyncStatus: lastSync[0]?.status ?? "never",
      },
      suppliers: {
        total: suppliers.length,
        active: suppliers.filter((s) => s.status === "active").length,
      },
    };
  },
});
