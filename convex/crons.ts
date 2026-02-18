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
//
// Task SLA Escalation (every 30 minutes):
//   Scans open tasks against their dueAt SLA.
//   24hr+ overdue → level 1, priority → high, task_overdue warning.
//   48hr+ overdue → level 2, priority → urgent, critical alert.
// ============================================================

const crons = cronJobs();

// Every hour: check all inventory levels against thresholds
crons.interval(
  "stock-level-monitor",
  { hours: 1 },
  internal.inventory.stockmonitor.checkStockLevels
);

// Every 6 hours: check for overdue purchase orders
crons.interval(
  "overdue-po-monitor",
  { hours: 6 },
  internal.inventory.stockmonitor.checkOverduePOs
);

// Every 30 minutes: escalate overdue tasks per SLA policy
crons.interval(
  "task-sla-escalation",
  { minutes: 30 },
  internal.agent.taskEscalation.checkTaskSLAs
);

export default crons;