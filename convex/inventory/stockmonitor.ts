import { internalMutation } from "../_generated/server";

// ============================================================
// STOCK MONITOR — Automated Inventory Health Checks
// ============================================================
// Called by cron jobs (convex/crons.ts). Not exposed to clients.
//
// checkStockLevels: Scans all inventory rows against min/max
//   thresholds, creates low_stock / out_of_stock alerts for new
//   violations, auto-resolves alerts when stock recovers.
//
// checkOverduePOs: Finds shipped/confirmed POs past their
//   expected delivery date and generates po_overdue alerts.
// ============================================================

// ----------------------------------------------------------
// STOCK LEVEL CHECK (runs hourly via cron)
// ----------------------------------------------------------
export const checkStockLevels = internalMutation({
  handler: async (ctx) => {
    const inventory = await ctx.db.query("inventory").collect();

    let alertsCreated = 0;
    let alertsResolved = 0;
    let itemsChecked = 0;

    for (const inv of inventory) {
      itemsChecked++;

      // Skip rows without a threshold — nothing to check
      if (inv.minimumStock === undefined || inv.minimumStock === null) continue;

      const component = await ctx.db.get(inv.componentId);
      if (!component) continue;

      const isLow = inv.quantity <= inv.minimumStock && inv.quantity > 0;
      const isOut = inv.quantity <= 0;

      // Find any existing active/acknowledged low_stock or out_of_stock
      // alert for this specific component
      const existingAlerts = await ctx.db
        .query("alerts")
        .withIndex("by_component", (q) => q.eq("componentId", inv.componentId))
        .collect();

      const activeStockAlert = existingAlerts.find(
        (a) =>
          (a.type === "low_stock" || a.type === "out_of_stock") &&
          (a.status === "active" || a.status === "acknowledged")
      );

      if (isOut) {
        // --- OUT OF STOCK ---
        if (activeStockAlert && activeStockAlert.type === "out_of_stock") {
          // Already have an out_of_stock alert — skip
          continue;
        }
        if (activeStockAlert && activeStockAlert.type === "low_stock") {
          // Escalate: resolve the low_stock, create out_of_stock
          await ctx.db.patch(activeStockAlert._id, {
            status: "resolved",
            resolvedBy: "stock_monitor",
            resolvedAt: Date.now(),
            resolvedAction: "Escalated to out_of_stock",
            updatedAt: Date.now(),
          });
        }

        await ctx.db.insert("alerts", {
          type: "out_of_stock",
          severity: "critical",
          title: `OUT OF STOCK: ${component.name}`,
          message: `${component.name} (${component.partNumber}) has zero stock. ` +
            `Minimum threshold is ${inv.minimumStock}. ` +
            `Immediate reorder required to avoid blocking build orders.`,
          componentId: inv.componentId,
          status: "active",
          agentGenerated: true,
          agentContext: JSON.stringify({
            trigger: "stock_monitor_cron",
            quantity: inv.quantity,
            minimumStock: inv.minimumStock,
            locationId: inv.locationId,
          }),
          updatedAt: Date.now(),
        });
        alertsCreated++;
      } else if (isLow) {
        // --- LOW STOCK ---
        if (activeStockAlert) {
          // Already have an active alert — skip
          continue;
        }

        // Check if there's an incoming PO for this component
        const pendingPOLines = await ctx.db
          .query("purchaseOrderLines")
          .withIndex("by_component", (q) => q.eq("componentId", inv.componentId))
          .collect();

        const incomingQty = await getPendingIncomingQty(ctx, pendingPOLines);

        const severity = inv.quantity <= Math.floor(inv.minimumStock / 2)
          ? "critical"
          : "warning";

        let message = `${component.name} (${component.partNumber}) is low: ` +
          `${inv.quantity} in stock, minimum is ${inv.minimumStock}.`;

        if (incomingQty > 0) {
          message += ` Note: ${incomingQty} units are on order and expected soon.`;
        } else {
          message += ` No purchase orders are pending for this component — consider reordering.`;
        }

        await ctx.db.insert("alerts", {
          type: "low_stock",
          severity,
          title: `Low Stock: ${component.name}`,
          message,
          componentId: inv.componentId,
          status: "active",
          agentGenerated: true,
          agentContext: JSON.stringify({
            trigger: "stock_monitor_cron",
            quantity: inv.quantity,
            minimumStock: inv.minimumStock,
            locationId: inv.locationId,
            incomingQty,
          }),
          updatedAt: Date.now(),
        });
        alertsCreated++;
      } else {
        // --- STOCK IS HEALTHY ---
        // Auto-resolve any lingering low_stock / out_of_stock alerts
        if (activeStockAlert) {
          await ctx.db.patch(activeStockAlert._id, {
            status: "resolved",
            resolvedBy: "stock_monitor",
            resolvedAt: Date.now(),
            resolvedAction: `Stock recovered to ${inv.quantity} (min: ${inv.minimumStock})`,
            updatedAt: Date.now(),
          });
          alertsResolved++;
        }
      }
    }

    console.log(
      `[StockMonitor] Checked ${itemsChecked} inventory rows. ` +
      `Created ${alertsCreated} alerts, resolved ${alertsResolved}.`
    );

    return { itemsChecked, alertsCreated, alertsResolved };
  },
});

// Helper: sum pending incoming quantities from active POs for given PO lines
async function getPendingIncomingQty(ctx: any, poLines: any[]): Promise<number> {
  let incoming = 0;
  for (const line of poLines) {
    if (line.status === "pending" || line.status === "partial") {
      const po = await ctx.db.get(line.purchaseOrderId);
      if (po && !["received", "cancelled"].includes(po.status)) {
        incoming += line.quantityOrdered - line.quantityReceived;
      }
    }
  }
  return incoming;
}

// ----------------------------------------------------------
// OVERDUE PO CHECK (runs every 6 hours via cron)
// ----------------------------------------------------------
export const checkOverduePOs = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const pos = await ctx.db.query("purchaseOrders").collect();

    let alertsCreated = 0;

    for (const po of pos) {
      // Only check active POs with expected delivery dates
      if (["received", "cancelled"].includes(po.status)) continue;
      if (!po.expectedDelivery) continue;
      if (po.expectedDelivery >= now) continue;

      // PO is overdue — check if we already have an alert for it
      const existingAlerts = await ctx.db
        .query("alerts")
        .withIndex("by_type", (q) => q.eq("type", "po_overdue"))
        .collect();

      const alreadyAlerted = existingAlerts.some(
        (a) =>
          a.purchaseOrderId === po._id &&
          (a.status === "active" || a.status === "acknowledged")
      );

      if (alreadyAlerted) continue;

      const supplier = await ctx.db.get(po.supplierId);
      const daysOverdue = Math.ceil((now - po.expectedDelivery) / (1000 * 60 * 60 * 24));
      const severity = daysOverdue > 7 ? "critical" : "warning";

      await ctx.db.insert("alerts", {
        type: "po_overdue",
        severity,
        title: `PO Overdue: ${po.poNumber}`,
        message: `${po.poNumber} from ${supplier?.name ?? "Unknown"} is ${daysOverdue} day(s) overdue. ` +
          `Expected delivery was ${new Date(po.expectedDelivery).toLocaleDateString()}. ` +
          `Current status: ${po.status}.` +
          (po.trackingNumber ? ` Tracking: ${po.trackingNumber}.` : ` No tracking number on file.`),
        purchaseOrderId: po._id,
        status: "active",
        agentGenerated: true,
        agentContext: JSON.stringify({
          trigger: "overdue_po_cron",
          poNumber: po.poNumber,
          expectedDelivery: po.expectedDelivery,
          daysOverdue,
          poStatus: po.status,
        }),
        updatedAt: Date.now(),
      });
      alertsCreated++;
    }

    console.log(`[OverduePOCheck] Created ${alertsCreated} overdue PO alerts.`);
    return { alertsCreated };
  },
});