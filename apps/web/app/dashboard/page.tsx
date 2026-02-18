"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { PageHeader, StatCard, StatusBadge, LoadingState } from "@/components/ui";
import {
  Package,
  Cpu,
  AlertTriangle,
  ListChecks,
  ClipboardList,
  Hammer,
  TrendingDown,
  Clock,
} from "lucide-react";
import { formatRelativeTime, formatCurrency } from "@/lib/utils";
import {
  ALERT_SEVERITY_CONFIG,
  TASK_PRIORITY_CONFIG,
  TASK_STATUS_CONFIG,
  PO_STATUS_CONFIG,
  BUILD_STATUS_CONFIG,
  PRODUCT_LABELS,
} from "@/lib/constants";
import Link from "next/link";

export default function DashboardPage() {
  const overview = useQuery(api.dashboard.getOverview);

  if (overview === undefined) {
    return <LoadingState message="Loading operations overview…" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Dashboard"
        description="CCS Technologies — operational snapshot"
      />

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Components"
          value={overview?.totalComponents ?? 0}
          subtitle="Active in catalog"
          icon={Cpu}
        />
        <StatCard
          label="Total Stock Value"
          value={formatCurrency(overview?.totalStockValue ?? 0)}
          subtitle={`${overview?.totalInventoryItems ?? 0} line items`}
          icon={Package}
        />
        <StatCard
          label="Open Alerts"
          value={overview?.openAlerts ?? 0}
          subtitle={`${overview?.criticalAlerts ?? 0} critical`}
          icon={AlertTriangle}
          accent={(overview?.criticalAlerts ?? 0) > 0}
        />
        <StatCard
          label="Pending Tasks"
          value={overview?.pendingTasks ?? 0}
          subtitle={`${overview?.overdueTasks ?? 0} overdue`}
          icon={ListChecks}
          accent={(overview?.overdueTasks ?? 0) > 0}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Low Stock Alerts */}
        <div className="card col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              <TrendingDown size={14} className="mr-1.5 inline text-status-warning" />
              Low Stock
            </h3>
            <Link href="/alerts" className="text-2xs text-accent hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2.5">
            {overview?.lowStockComponents?.length === 0 && (
              <p className="py-4 text-center text-xs text-text-tertiary">
                All stock levels healthy
              </p>
            )}
            {overview?.lowStockComponents?.map(
              (item: { name: string; available: number; minimum: number; _id: string }, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2"
                >
                  <div>
                    <p className="text-xs font-medium text-text-primary">
                      {item.name}
                    </p>
                    <p className="text-2xs text-text-tertiary">
                      {item.available} available · min {item.minimum}
                    </p>
                  </div>
                  <span className="badge bg-amber-500/15 text-amber-400">
                    Low
                  </span>
                </div>
              )
            )}
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="card col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              <AlertTriangle size={14} className="mr-1.5 inline text-status-danger" />
              Recent Alerts
            </h3>
            <Link href="/alerts" className="text-2xs text-accent hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2.5">
            {overview?.recentAlerts?.length === 0 && (
              <p className="py-4 text-center text-xs text-text-tertiary">
                No active alerts
              </p>
            )}
            {overview?.recentAlerts?.map(
              (alert: { title: string; severity: string; _creationTime: number; _id: string }, i: number) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-md bg-surface-2 px-3 py-2"
                >
                  <div
                    className={`h-2 w-2 flex-shrink-0 rounded-full ${
                      ALERT_SEVERITY_CONFIG[alert.severity]?.dot ?? "bg-surface-4"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-text-primary">
                      {alert.title}
                    </p>
                    <p className="text-2xs text-text-tertiary">
                      {formatRelativeTime(alert._creationTime)}
                    </p>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Pending Tasks */}
        <div className="card col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              <Clock size={14} className="mr-1.5 inline text-status-info" />
              Pending Tasks
            </h3>
            <Link href="/tasks" className="text-2xs text-accent hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2.5">
            {overview?.recentTasks?.length === 0 && (
              <p className="py-4 text-center text-xs text-text-tertiary">
                No pending tasks
              </p>
            )}
            {overview?.recentTasks?.map(
              (task: { title: string; priority: string; category: string; _id: string }, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-text-primary">
                      {task.title}
                    </p>
                    <p className="text-2xs text-text-tertiary">{task.category}</p>
                  </div>
                  <StatusBadge
                    status={task.priority}
                    config={TASK_PRIORITY_CONFIG}
                  />
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Active Orders & Builds */}
      <div className="grid grid-cols-2 gap-4">
        {/* Active POs */}
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              <ClipboardList size={14} className="mr-1.5 inline text-text-tertiary" />
              Active Purchase Orders
            </h3>
            <Link href="/orders" className="text-2xs text-accent hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {overview?.activePOs?.length === 0 && (
              <p className="py-4 text-center text-xs text-text-tertiary">
                No active purchase orders
              </p>
            )}
            {overview?.activePOs?.map(
              (po: { poNumber: string; supplierName: string; status: string; total: number; _id: string }, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2.5"
                >
                  <div>
                    <p className="text-xs font-mono font-medium text-text-primary">
                      {po.poNumber}
                    </p>
                    <p className="text-2xs text-text-tertiary">
                      {po.supplierName} · {formatCurrency(po.total)}
                    </p>
                  </div>
                  <StatusBadge status={po.status} config={PO_STATUS_CONFIG} />
                </div>
              )
            )}
          </div>
        </div>

        {/* Active Builds */}
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              <Hammer size={14} className="mr-1.5 inline text-text-tertiary" />
              Active Build Orders
            </h3>
            <Link href="/builds" className="text-2xs text-accent hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-2">
            {overview?.activeBuilds?.length === 0 && (
              <p className="py-4 text-center text-xs text-text-tertiary">
                No active build orders
              </p>
            )}
            {overview?.activeBuilds?.map(
              (build: { buildNumber: string; product: string; status: string; quantity: number; _id: string }, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md bg-surface-2 px-3 py-2.5"
                >
                  <div>
                    <p className="text-xs font-mono font-medium text-text-primary">
                      {build.buildNumber}
                    </p>
                    <p className="text-2xs text-text-tertiary">
                      {PRODUCT_LABELS[build.product] ?? build.product} · Qty{" "}
                      {build.quantity}
                    </p>
                  </div>
                  <StatusBadge
                    status={build.status}
                    config={BUILD_STATUS_CONFIG}
                  />
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
