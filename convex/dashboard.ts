import { query } from "./_generated/server";

// ============================================================
// DASHBOARD — Aggregate Operational Overview
// ============================================================
// Returns the exact shape the web dashboard frontend expects.
// See CONVEX_API_CONTRACT.md for the full specification.
// ============================================================

export const getOverview = query({
  handler: async (ctx) => {
    // --- Components ---
    const components = await ctx.db.query("components").collect();
    const totalComponents = components.length;

    // --- Inventory ---
    const inventory = await ctx.db.query("inventory").collect();
    const totalInventoryItems = inventory.length;

    // Calculate total stock value (sum of quantity * costPerUnit where available)
    let totalStockValue = 0;
    for (const inv of inventory) {
      if (inv.costPerUnit) {
        totalStockValue += inv.quantity * inv.costPerUnit;
      }
    }

    // Low stock components: join inventory with components for display
    const lowStockInventory = inventory.filter(
      (i) => i.status === "low_stock" || i.status === "out_of_stock"
    );
    const lowStockComponents = await Promise.all(
      lowStockInventory.slice(0, 10).map(async (inv) => {
        const component = await ctx.db.get(inv.componentId);
        return {
          _id: inv._id,
          name: component?.name ?? "Unknown",
          available: inv.availableQty,
          minimum: inv.minimumStock ?? 0,
        };
      })
    );

    // --- Alerts ---
    const alerts = await ctx.db.query("alerts").collect();
    const activeAlertsList = alerts.filter((a) => a.status === "active");
    const openAlerts = activeAlertsList.length;
    const criticalAlerts = activeAlertsList.filter(
      (a) => a.severity === "critical"
    ).length;

    // Recent alerts: sorted by _creationTime desc, take 5
    const recentAlerts = activeAlertsList
      .sort((a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0))
      .slice(0, 5)
      .map((a) => ({
        _id: a._id,
        title: a.title,
        severity: a.severity,
        createdAt: a._creationTime,
      }));

    // --- Tasks ---
    const tasks = await ctx.db.query("tasks").collect();
    const activeTasks = tasks.filter(
      (t) => ["pending", "assigned", "in_progress"].includes(t.status)
    );
    const pendingTasks = activeTasks.length;
    const overdueTasks = tasks.filter(
      (t) =>
        t.dueAt &&
        t.dueAt < Date.now() &&
        !["completed", "verified", "cancelled"].includes(t.status)
    ).length;

    // Recent tasks: sorted by priority then creation
    const priorityOrder: Record<string, number> = {
      urgent: 0,
      high: 1,
      normal: 2,
      low: 3,
    };
    const recentTasks = activeTasks
      .sort(
        (a, b) =>
          (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2) ||
          (b._creationTime ?? 0) - (a._creationTime ?? 0)
      )
      .slice(0, 5)
      .map((t) => ({
        _id: t._id,
        title: t.title,
        priority: t.priority,
        category: t.type, // Contract uses "category", schema uses "type"
      }));

    // --- Purchase Orders ---
    const pos = await ctx.db.query("purchaseOrders").collect();
    const openPOsList = pos.filter((po) =>
      ["draft", "submitted", "confirmed", "shipped", "partial_received"].includes(
        po.status
      )
    );

    const activePOs = await Promise.all(
      openPOsList.slice(0, 5).map(async (po) => {
        const supplier = await ctx.db.get(po.supplierId);
        return {
          _id: po._id,
          poNumber: po.poNumber,
          supplierName: supplier?.name ?? "Unknown",
          status: po.status,
          total: po.totalCost ?? 0,
        };
      })
    );

    // --- Build Orders ---
    const builds = await ctx.db.query("buildOrders").collect();
    const activeBuildsList = builds.filter((b) =>
      ["planned", "materials_reserved", "in_progress", "qc"].includes(b.status)
    );

    const activeBuilds = activeBuildsList.slice(0, 5).map((b) => ({
      _id: b._id,
      buildNumber: b.buildNumber,
      product: b.productName, // Contract uses "product", schema uses "productName"
      status: b.status,
      quantity: b.quantity,
    }));

    return {
      totalComponents,
      totalStockValue,
      totalInventoryItems,
      openAlerts,
      criticalAlerts,
      pendingTasks,
      overdueTasks,
      lowStockComponents,
      recentAlerts,
      recentTasks,
      activePOs,
      activeBuilds,
    };
  },
});

// ============================================================
// Extended overview for internal/agent use (preserves original shape)
// ============================================================
export const overview = query({
  handler: async (ctx) => {
    const components = await ctx.db.query("components").collect();
    const activeComponents = components.filter((c) => c.status === "active").length;

    const inventory = await ctx.db.query("inventory").collect();
    const lowStock = inventory.filter((i) => i.status === "low_stock").length;
    const outOfStock = inventory.filter((i) => i.status === "out_of_stock").length;

    const pos = await ctx.db.query("purchaseOrders").collect();
    const openPOs = pos.filter((po) =>
      ["draft", "submitted", "confirmed", "shipped", "partial_received"].includes(po.status)
    ).length;
    const overduePOs = pos.filter(
      (po) =>
        po.expectedDelivery &&
        po.expectedDelivery < Date.now() &&
        !["received", "cancelled"].includes(po.status)
    ).length;

    const builds = await ctx.db.query("buildOrders").collect();
    const activeBuilds = builds.filter((b) =>
      ["planned", "materials_reserved", "in_progress", "qc"].includes(b.status)
    ).length;

    const alerts = await ctx.db.query("alerts").collect();
    const activeAlerts = alerts.filter((a) => a.status === "active").length;
    const criticalAlerts = alerts.filter(
      (a) => a.status === "active" && a.severity === "critical"
    ).length;

    const tasks = await ctx.db.query("tasks").collect();
    const pendingTasks = tasks.filter((t) =>
      ["pending", "assigned", "in_progress"].includes(t.status)
    ).length;
    const overdueTasks = tasks.filter(
      (t) =>
        t.dueAt &&
        t.dueAt < Date.now() &&
        !["completed", "verified", "cancelled"].includes(t.status)
    ).length;

    const driveFiles = await ctx.db.query("driveFiles").collect();
    const lastSync = await ctx.db
      .query("driveSyncLog")
      .withIndex("by_startedAt")
      .order("desc")
      .take(1);

    const suppliers = await ctx.db.query("suppliers").collect();

    return {
      components: { total: components.length, active: activeComponents },
      inventory: {
        totalRecords: inventory.length,
        lowStock,
        outOfStock,
        healthy: inventory.length - lowStock - outOfStock,
      },
      purchaseOrders: { total: pos.length, open: openPOs, overdue: overduePOs },
      buildOrders: { total: builds.length, active: activeBuilds },
      alerts: { active: activeAlerts, critical: criticalAlerts },
      tasks: { pending: pendingTasks, overdue: overdueTasks },
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
