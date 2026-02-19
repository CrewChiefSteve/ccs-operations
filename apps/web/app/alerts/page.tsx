"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  PageHeader,
  StatusBadge,
  EmptyState,
  LoadingState,
} from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  Eye,
  XCircle,
  ShieldAlert,
  Info,
  TriangleAlert,
} from "lucide-react";
import { ALERT_SEVERITY_CONFIG } from "@/lib/constants";
import { formatRelativeTime, formatDate, cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Alert = {
  _id: any;
  type: string;
  severity: string;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  status: string;
  assignedTo?: string;
  _creationTime: number;
  resolvedAt?: number;
  resolvedBy?: string;
};

const ALERT_TYPE_LABELS: Record<string, string> = {
  low_stock: "Low Stock",
  po_overdue: "PO Overdue",
  qc_failure: "QC Failure",
  structure_violation: "Structure Violation",
  count_needed: "Count Needed",
};

export default function AlertsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const alerts = useQuery(api.agent.alerts.list, {
    status: statusFilter === "all" ? undefined : statusFilter,
    severity: severityFilter === "all" ? undefined : severityFilter,
  });

  const acknowledgeAlert = useMutation(api.agent.alerts.acknowledge);
  const resolveAlert = useMutation(api.agent.alerts.resolve);
  const dismissAlert = useMutation(api.agent.alerts.dismiss);

  const severityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <ShieldAlert size={18} className="text-red-400" />;
      case "warning":
        return <TriangleAlert size={18} className="text-amber-400" />;
      default:
        return <Info size={18} className="text-blue-400" />;
    }
  };

  const openCount = alerts?.filter((a: Alert) => a.status === "open").length ?? 0;
  const criticalCount =
    alerts?.filter(
      (a: Alert) => a.severity === "critical" && a.status === "open"
    ).length ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Alert Center"
        description={`${openCount} open alert${openCount !== 1 ? "s" : ""}${criticalCount > 0 ? ` · ${criticalCount} critical` : ""}`}
      />

      {/* Critical banner */}
      {criticalCount > 0 && statusFilter !== "resolved" && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
          <ShieldAlert size={18} className="flex-shrink-0 text-red-400" />
          <p className="text-sm text-red-300">
            <span className="font-semibold">{criticalCount} critical</span>{" "}
            alert{criticalCount !== 1 ? "s" : ""} require{criticalCount === 1 ? "s" : ""} attention
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex rounded-lg border border-surface-4 bg-surface-1 p-0.5">
          {["open", "acknowledged", "all", "resolved"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === s
                  ? "bg-surface-3 text-text-primary"
                  : "text-text-tertiary hover:text-text-secondary"
              )}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="input-base w-36"
        >
          <option value="all">All Severity</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>

      {/* Alerts List */}
      {alerts === undefined ? (
        <LoadingState />
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={statusFilter === "open" ? Bell : BellOff}
          title={
            statusFilter === "open"
              ? "No open alerts"
              : "No alerts found"
          }
          description={
            statusFilter === "open"
              ? "All clear! The agent will create alerts when something needs attention."
              : "Try a different filter"
          }
        />
      ) : (
        <div className="space-y-2">
          {alerts.map((alert: Alert) => (
            <div
              key={alert._id}
              className={cn(
                "card-compact transition-all",
                alert.severity === "critical" &&
                  alert.status === "open" &&
                  "border-red-500/30 bg-red-500/[0.02]",
                alert.status === "resolved" && "opacity-60"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  {severityIcon(alert.severity)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-text-primary">
                      {alert.title}
                    </h3>
                    <StatusBadge
                      status={alert.severity}
                      config={ALERT_SEVERITY_CONFIG}
                    />
                    <Badge className="bg-surface-3 text-text-tertiary">
                      {ALERT_TYPE_LABELS[alert.type] ?? alert.type}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                    {alert.message}
                  </p>
                  <div className="mt-2 flex items-center gap-4 text-2xs text-text-tertiary">
                    <span>{formatRelativeTime(alert._creationTime)}</span>
                    {alert.status === "acknowledged" && (
                      <span className="flex items-center gap-1 text-blue-400">
                        <Eye size={10} />
                        Acknowledged
                      </span>
                    )}
                    {alert.status === "resolved" && (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 size={10} />
                        Resolved{" "}
                        {alert.resolvedAt && formatRelativeTime(alert.resolvedAt)}
                        {alert.resolvedBy && ` by ${alert.resolvedBy}`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {alert.status === "open" && (
                  <div className="flex flex-shrink-0 gap-1">
                    <button
                      onClick={() =>
                        acknowledgeAlert({ alertId: alert._id })
                      }
                      className="btn-ghost text-xs"
                      title="Acknowledge"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={() =>
                        resolveAlert({
                          alertId: alert._id,
                          resolvedBy: "manual",
                        })
                      }
                      className="btn-ghost text-xs text-status-success"
                      title="Resolve"
                    >
                      <CheckCircle2 size={14} />
                    </button>
                    <button
                      onClick={() => dismissAlert({ alertId: alert._id })}
                      className="btn-ghost text-xs text-text-tertiary"
                      title="Dismiss"
                    >
                      <XCircle size={14} />
                    </button>
                  </div>
                )}
                {alert.status === "acknowledged" && (
                  <div className="flex flex-shrink-0 gap-1">
                    <button
                      onClick={() =>
                        resolveAlert({
                          alertId: alert._id,
                          resolvedBy: "manual",
                        })
                      }
                      className="btn-ghost text-xs text-status-success"
                      title="Resolve"
                    >
                      <CheckCircle2 size={14} />
                      Resolve
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
