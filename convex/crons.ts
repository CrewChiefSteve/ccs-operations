import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// ============================================================
// CRON JOBS — Automated Operational Monitors
// ============================================================
// These are the "OBSERVE" step in the Meat Bag Director loop:
//   OBSERVE → REASON → DIRECT → VERIFY → ESCALATE
//
// Stock Monitor (hourly):
//   Scans inventory against min/max thresholds.
//   Creates low_stock / out_of_stock alerts.
//   Auto-resolves alerts when stock recovers.
//
// Overdue PO Check (every 6 hours):
//   Finds POs past their expected delivery date.
//   Creates po_overdue alerts.
// ============================================================

const crons = cronJobs();

// Every hour: check all inventory levels against thresholds
crons.interval(
  "stock-level-monitor",
  { hours: 1 },
  internal.inventory.stockMonitor.checkStockLevels
);

// Every 6 hours: check for overdue purchase orders
crons.interval(
  "overdue-po-monitor",
  { hours: 6 },
  internal.inventory.stockMonitor.checkOverduePOs
);

export default crons;