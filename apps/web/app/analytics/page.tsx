"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  PageHeader,
  StatCard,
  LoadingState,
  EmptyState,
} from "@/components/ui";
import {
  ChartCard,
  CCSLineChart,
  CCSBarChart,
  CCSAreaChart,
} from "@/components/charts";
import { PRODUCT_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart3,
  DollarSign,
  Truck,
  Activity,
  TrendingUp,
  Package,
  Star,
} from "lucide-react";

type Period = "30d" | "90d" | "180d";

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("90d");
  const [burnPeriod, setBurnPeriod] = useState<"30d" | "90d" | "all">("90d");

  const periodMs = period === "30d" ? 30 : period === "90d" ? 90 : 180;
  // Memoize startDate so it doesn't change on every render.
  // Date.now() in the render body creates a new value each render,
  // causing useQuery to see new args → new query → re-render → loop.
  const startDate = useMemo(
    () => Date.now() - periodMs * 86400000,
    [periodMs]
  );

  const summaryStats = useQuery(api.analytics.getSummaryStats);
  const spendData = useQuery(api.analytics.getSpendByPeriod, {
    startDate,
    groupBy: period === "30d" ? "day" : "month",
  });
  const burnRate = useQuery(api.analytics.getBurnRate, {
    period: burnPeriod,
    limit: 10,
  });
  const leadTime = useQuery(api.analytics.getLeadTimeAnalysis, {});
  const inventoryValue = useQuery(api.analytics.getInventoryValueHistory, {
    period,
  });
  const costTrends = useQuery(api.analytics.getCostTrends, { limit: 50 });
  const supplierPerf = useQuery(api.analytics.getSupplierPerformance);

  const currencyFormatter = useCallback((v: number) => formatCurrency(v), []);
  const daysFormatter = useCallback((v: number) => `${v}d`, []);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        description="Historical trends and operational insights"
        actions={
          <div className="flex items-center gap-1 rounded-lg bg-surface-2 p-0.5">
            {(["30d", "90d", "180d"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  period === p
                    ? "bg-surface-3 text-text-primary"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {p === "30d" ? "30 Days" : p === "90d" ? "90 Days" : "6 Months"}
              </button>
            ))}
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="30-Day Spend"
          value={
            summaryStats
              ? formatCurrency(summaryStats.spend30d)
              : "..."
          }
          subtitle={`${summaryStats?.poCount30d ?? 0} purchase orders`}
          icon={DollarSign}
        />
        <StatCard
          label="Avg Lead Time"
          value={
            summaryStats?.avgLeadTimeDays != null
              ? `${summaryStats.avgLeadTimeDays}d`
              : "—"
          }
          subtitle="From order to delivery"
          icon={Truck}
        />
        <StatCard
          label="Transactions (30d)"
          value={summaryStats?.transactionCount30d ?? "..."}
          subtitle="Inventory movements"
          icon={Activity}
        />
        <StatCard
          label="Active Suppliers"
          value={supplierPerf?.length ?? "..."}
          subtitle="With order history"
          icon={Package}
        />
      </div>

      {/* Row 1: Spend Trends + Inventory Value */}
      <div className="grid grid-cols-2 gap-4">
        <ChartCard
          title="Purchase Order Spend"
          description={`Total spend by ${period === "30d" ? "day" : "month"}`}
        >
          {spendData === undefined ? (
            <LoadingState message="Loading..." />
          ) : spendData.length === 0 ? (
            <EmptyState
              icon={DollarSign}
              title="No spend data"
              description="Purchase orders with costs will appear here"
            />
          ) : (
            <CCSBarChart
              data={spendData}
              xKey="label"
              bars={[{ dataKey: "total", name: "Spend", color: "#e85d26" }]}
              yFormatter={currencyFormatter}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Inventory Value"
          description="Total stock value over time"
        >
          {inventoryValue === undefined ? (
            <LoadingState message="Loading..." />
          ) : inventoryValue.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No inventory data"
              description="Inventory transactions will populate this chart"
            />
          ) : (
            <CCSAreaChart
              data={inventoryValue}
              xKey="label"
              dataKey="value"
              name="Inventory Value"
              yFormatter={currencyFormatter}
            />
          )}
        </ChartCard>
      </div>

      {/* Row 2: Burn Rate + Lead Time */}
      <div className="grid grid-cols-2 gap-4">
        <ChartCard
          title="Component Burn Rate"
          description="Top consumed components"
          action={
            <div className="flex items-center gap-1 rounded-lg bg-surface-2 p-0.5">
              {(["30d", "90d", "all"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setBurnPeriod(p)}
                  className={`rounded-md px-2 py-1 text-2xs font-medium transition-colors ${
                    burnPeriod === p
                      ? "bg-surface-3 text-text-primary"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                >
                  {p === "all" ? "All" : p}
                </button>
              ))}
            </div>
          }
        >
          {burnRate === undefined ? (
            <LoadingState message="Loading..." />
          ) : burnRate.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No consumption data"
              description="Component consume transactions will appear here"
            />
          ) : (
            <CCSBarChart
              data={burnRate.map((b: { componentName: string; totalConsumed: number; avgPerDay: number; partNumber: string }) => ({
                ...b,
                name: b.componentName.length > 20
                  ? b.componentName.slice(0, 18) + "..."
                  : b.componentName,
              }))}
              xKey="name"
              bars={[
                { dataKey: "totalConsumed", name: "Units Consumed" },
              ]}
              colorByIndex
              height={300}
            />
          )}
        </ChartCard>

        <ChartCard
          title="Supplier Lead Times"
          description="Expected vs actual delivery (days)"
        >
          {leadTime === undefined ? (
            <LoadingState message="Loading..." />
          ) : leadTime.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No delivery data"
              description="Completed POs with delivery dates will appear here"
            />
          ) : (
            <CCSBarChart
              data={leadTime}
              xKey="supplierName"
              bars={[
                {
                  dataKey: "avgExpectedDays",
                  name: "Expected",
                  color: "#3b82f6",
                },
                {
                  dataKey: "avgActualDays",
                  name: "Actual",
                  color: "#e85d26",
                },
              ]}
              yFormatter={daysFormatter}
            />
          )}
        </ChartCard>
      </div>

      {/* Row 3: COGS Trends */}
      {costTrends && costTrends.length > 0 && (
        <ChartCard
          title="COGS Per Unit Trends"
          description="Cost per unit over time by product"
        >
          {(() => {
            // Group by product
            const productNames: string[] = [];
            for (const c of costTrends) {
              if (!productNames.includes(c.productName)) {
                productNames.push(c.productName);
              }
            }
            const lines = productNames.map((p: string) => ({
              dataKey: p,
              name: PRODUCT_LABELS[p] ?? p,
            }));

            // Pivot data: each row is a timestamp with product columns
            const pivoted: Array<Record<string, unknown>> = [];
            for (const item of costTrends) {
              let row = pivoted.find((r) => r.label === item.label);
              if (!row) {
                row = { label: item.label, calculatedAt: item.calculatedAt };
                pivoted.push(row);
              }
              row[item.productName] = item.costPerUnit;
            }

            return (
              <CCSLineChart
                data={pivoted}
                xKey="label"
                lines={lines}
                yFormatter={currencyFormatter}
              />
            );
          })()}
        </ChartCard>
      )}

      {/* Supplier Performance Table */}
      <ChartCard
        title="Supplier Performance"
        description="Aggregated metrics across all purchase orders"
      >
        {supplierPerf === undefined ? (
          <LoadingState message="Loading..." />
        ) : supplierPerf.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No supplier data"
            description="Create purchase orders to track supplier performance"
          />
        ) : (
          <div className="rounded-lg border border-surface-4 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-4 bg-surface-2">
                  <th className="px-3 py-2 text-left text-2xs font-semibold uppercase text-text-tertiary">
                    Supplier
                  </th>
                  <th className="px-3 py-2 text-center text-2xs font-semibold uppercase text-text-tertiary">
                    Rating
                  </th>
                  <th className="px-3 py-2 text-right text-2xs font-semibold uppercase text-text-tertiary">
                    Orders
                  </th>
                  <th className="px-3 py-2 text-right text-2xs font-semibold uppercase text-text-tertiary">
                    Total Spend
                  </th>
                  <th className="px-3 py-2 text-right text-2xs font-semibold uppercase text-text-tertiary">
                    On-Time %
                  </th>
                  <th className="px-3 py-2 text-right text-2xs font-semibold uppercase text-text-tertiary">
                    Avg Lead Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {supplierPerf.map((s: any) => (
                  <tr
                    key={s.supplierId}
                    className="border-b border-surface-4/50"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-2xs text-text-tertiary">
                          {s.supplierCode}
                        </span>
                        <span className="font-medium text-text-primary">
                          {s.supplierName}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {s.rating ? (
                        <div className="flex items-center justify-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={10}
                              className={
                                i < s.rating!
                                  ? "text-amber-400 fill-amber-400"
                                  : "text-surface-4"
                              }
                            />
                          ))}
                        </div>
                      ) : (
                        <span className="text-2xs text-text-tertiary">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-text-secondary">
                      {s.totalOrders}
                      {s.completedOrders < s.totalOrders && (
                        <span className="text-2xs text-text-tertiary">
                          {" "}
                          ({s.completedOrders} completed)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-medium text-text-primary">
                      {formatCurrency(s.totalSpend)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {s.onTimePercent != null ? (
                        <span
                          className={`font-mono font-medium ${
                            s.onTimePercent >= 90
                              ? "text-emerald-400"
                              : s.onTimePercent >= 70
                                ? "text-amber-400"
                                : "text-red-400"
                          }`}
                        >
                          {s.onTimePercent}%
                        </span>
                      ) : (
                        <span className="text-2xs text-text-tertiary">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-text-secondary">
                      {s.avgLeadTimeDays != null
                        ? `${s.avgLeadTimeDays}d`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
