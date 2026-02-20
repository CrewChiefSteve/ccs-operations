import type { LucideIcon } from "lucide-react";
import {
  PackageSearch,
  Truck,
  Siren,
  FileSearch,
  Newspaper,
} from "lucide-react";

// ============================================================
// THE OPS CREW — Named Agent Identities
// ============================================================
// Static config mapping the 5 autonomous agent subsystems to
// named identities. No schema changes needed — agent identity
// is resolved from agentContext.trigger strings at display time.
// ============================================================

export type AgentId =
  | "stockWatcher"
  | "poTracker"
  | "slaEnforcer"
  | "bomSync"
  | "briefingWriter";

export interface CrewMember {
  id: AgentId;
  name: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  cronInterval: string;
  triggerStrings: string[];
  alertTypes: string[];
  taskTypes: string[];
}

export const CREW: Record<AgentId, CrewMember> = {
  stockWatcher: {
    id: "stockWatcher",
    name: "Stockton",
    title: "Inventory Watchdog",
    description:
      "Scans inventory against min/max thresholds every hour. Creates low stock and out-of-stock alerts, and auto-resolves when stock recovers.",
    icon: PackageSearch,
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/15",
    cronInterval: "Every hour",
    triggerStrings: ["stock_monitor_cron", "stock_monitor"],
    alertTypes: ["low_stock", "out_of_stock"],
    taskTypes: [],
  },
  poTracker: {
    id: "poTracker",
    name: "Tracker",
    title: "Procurement Enforcer",
    description:
      "Monitors purchase orders every 6 hours and flags any past their expected delivery date. Escalates severity for POs overdue more than 7 days.",
    icon: Truck,
    color: "text-blue-400",
    bgColor: "bg-blue-400/15",
    cronInterval: "Every 6 hours",
    triggerStrings: ["overdue_po_cron"],
    alertTypes: ["po_overdue"],
    taskTypes: [],
  },
  slaEnforcer: {
    id: "slaEnforcer",
    name: "Sarge",
    title: "SLA Enforcer",
    description:
      "The Meat Bag Director. Checks task SLAs every 30 minutes. Bumps priority at 24h overdue, escalates to urgent and flags co-founder notification at 48h.",
    icon: Siren,
    color: "text-amber-400",
    bgColor: "bg-amber-400/15",
    cronInterval: "Every 30 min",
    triggerStrings: ["task_escalation_cron"],
    alertTypes: ["task_overdue"],
    taskTypes: [],
  },
  bomSync: {
    id: "bomSync",
    name: "Blueprint",
    title: "BOM Sync Analyst",
    description:
      "Scans Google Drive for BOM changes every 15 minutes. Detects component additions, removals, substitutions, and quantity changes. Creates tasks for human review.",
    icon: FileSearch,
    color: "text-purple-400",
    bgColor: "bg-purple-400/15",
    cronInterval: "Every 15 min",
    triggerStrings: [],
    alertTypes: ["bom_change", "structure_violation"],
    taskTypes: ["review_bom"],
  },
  briefingWriter: {
    id: "briefingWriter",
    name: "Debrief",
    title: "Morning Briefing Officer",
    description:
      "Gathers operational data at 7:00 AM CST and generates a daily briefing via the Claude API. Synthesizes inventory, Drive, task, and build data into an executive summary.",
    icon: Newspaper,
    color: "text-cyan-400",
    bgColor: "bg-cyan-400/15",
    cronInterval: "Daily 7:00 AM CST",
    triggerStrings: [],
    alertTypes: [],
    taskTypes: [],
  },
};

export const CREW_LIST: CrewMember[] = [
  CREW.stockWatcher,
  CREW.poTracker,
  CREW.slaEnforcer,
  CREW.bomSync,
  CREW.briefingWriter,
];

// ============================================================
// RESOLUTION: Map existing data → agent identity
// ============================================================

export function resolveAlertAgent(alert: {
  agentGenerated?: boolean;
  agentContext?: string | null;
  type: string;
}): CrewMember | null {
  if (!alert.agentGenerated) return null;

  // 1. Try matching by trigger string in agentContext
  if (alert.agentContext) {
    try {
      const ctx = JSON.parse(alert.agentContext);
      if (ctx.trigger) {
        const match = CREW_LIST.find((c) =>
          c.triggerStrings.includes(ctx.trigger)
        );
        if (match) return match;
      }
      if (
        ctx.relatedEntityType === "bomChangeLog" ||
        ctx.relatedEntityType === "driveFile"
      ) {
        return CREW.bomSync;
      }
    } catch {
      // Invalid JSON — fall through
    }
  }

  // 2. Fall back to alert type
  for (const member of CREW_LIST) {
    if (member.alertTypes.includes(alert.type)) return member;
  }

  return null;
}

export function resolveTaskAgent(task: {
  agentGenerated?: boolean;
  agentContext?: string | null;
  type?: string;
}): CrewMember | null {
  if (!task.agentGenerated) return null;

  if (task.agentContext) {
    try {
      const ctx = JSON.parse(task.agentContext);
      if (ctx.trigger) {
        const match = CREW_LIST.find((c) =>
          c.triggerStrings.includes(ctx.trigger)
        );
        if (match) return match;
      }
      if (
        ctx.relatedEntityType === "bomChangeLog" ||
        ctx.relatedEntityType === "driveFile"
      ) {
        return CREW.bomSync;
      }
    } catch {
      // fall through
    }
  }

  // Fall back to task type
  if (task.type) {
    for (const member of CREW_LIST) {
      if (member.taskTypes.includes(task.type)) return member;
    }
  }

  // Agent-generated but no specific match — default to Sarge
  return CREW.slaEnforcer;
}
