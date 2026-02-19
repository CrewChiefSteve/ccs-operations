"use client";

import { useState, FormEvent } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  PageHeader,
  DataTable,
  StatusBadge,
  EmptyState,
  LoadingState,
  Modal,
  FormField,
} from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Package, ArrowUpDown } from "lucide-react";
import { INVENTORY_STATUS_CONFIG } from "@/lib/constants";
import { formatDate, formatCurrency, cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InventoryRow = {
  _id: any;
  componentId: any;
  componentName: string;
  partNumber: string;
  locationName: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  status: string;
  costPerUnit?: number;
  lastCountedAt?: number;
  updatedAt: number;
};

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showAdjust, setShowAdjust] = useState(false);

  const inventory = useQuery(api.inventory.stock.listWithDetails, {
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const adjustStock = useMutation(api.inventory.stock.adjust);

  async function handleAdjust(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await adjustStock({
      inventoryId: form.get("inventoryId") as any,
      newQuantity: Number(form.get("newQuantity")),
      reason: form.get("reason") as string,
    });
    setShowAdjust(false);
  }

  const columns = [
    {
      key: "partNumber",
      header: "Part Number",
      className: "w-36",
      render: (row: InventoryRow) => (
        <span className="font-mono text-xs font-medium text-accent">
          {row.partNumber}
        </span>
      ),
    },
    {
      key: "name",
      header: "Component",
      render: (row: InventoryRow) => (
        <span className="font-medium text-text-primary">
          {row.componentName}
        </span>
      ),
    },
    {
      key: "location",
      header: "Location",
      className: "w-36",
      render: (row: InventoryRow) => (
        <span className="text-text-secondary">{row.locationName || "—"}</span>
      ),
    },
    {
      key: "quantity",
      header: "On Hand",
      className: "w-24 text-right",
      render: (row: InventoryRow) => (
        <span className="font-mono font-medium text-text-primary tabular-nums">
          {row.quantity}
        </span>
      ),
    },
    {
      key: "reserved",
      header: "Reserved",
      className: "w-24 text-right",
      render: (row: InventoryRow) => (
        <span
          className={cn(
            "font-mono tabular-nums",
            row.reservedQuantity > 0 ? "text-blue-400" : "text-text-tertiary"
          )}
        >
          {row.reservedQuantity}
        </span>
      ),
    },
    {
      key: "available",
      header: "Available",
      className: "w-24 text-right",
      render: (row: InventoryRow) => (
        <span
          className={cn(
            "font-mono font-semibold tabular-nums",
            row.availableQuantity <= 0
              ? "text-status-danger"
              : row.availableQuantity <= 5
                ? "text-status-warning"
                : "text-status-success"
          )}
        >
          {row.availableQuantity}
        </span>
      ),
    },
    {
      key: "cost",
      header: "Unit Cost",
      className: "w-24 text-right",
      render: (row: InventoryRow) => (
        <span className="text-text-secondary">
          {row.costPerUnit ? formatCurrency(row.costPerUnit) : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      className: "w-28",
      render: (row: InventoryRow) => (
        <StatusBadge status={row.status} config={INVENTORY_STATUS_CONFIG} />
      ),
    },
    {
      key: "counted",
      header: "Last Counted",
      className: "w-28",
      render: (row: InventoryRow) => (
        <span className="text-xs text-text-tertiary">
          {row.lastCountedAt ? formatDate(row.lastCountedAt) : "Never"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock Levels"
        description="Current inventory across all locations"
        actions={
          <button className="btn-secondary" onClick={() => setShowAdjust(true)}>
            <ArrowUpDown size={14} />
            Adjust Stock
          </button>
        }
      />

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
          />
          <input
            type="text"
            placeholder="Search inventory…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-base w-40"
        >
          <option value="all">All Status</option>
          {Object.entries(INVENTORY_STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>
              {cfg.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card-compact overflow-hidden p-0">
        {inventory === undefined ? (
          <LoadingState />
        ) : inventory.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No inventory records"
            description={
              search
                ? "Try a different search term"
                : "Inventory will populate as you receive purchase orders"
            }
          />
        ) : (
          <DataTable columns={columns} data={inventory} />
        )}
      </div>

      {/* Adjust Stock Modal */}
      <Modal
        open={showAdjust}
        onClose={() => setShowAdjust(false)}
        title="Adjust Stock"
        description="Manually adjust inventory quantity"
      >
        <form onSubmit={handleAdjust} className="space-y-4">
          <FormField label="Inventory Line" required>
            <select name="inventoryId" required className="input-base">
              <option value="">Select a line item…</option>
              {inventory?.map((item) => (
                <option key={item._id} value={item._id}>
                  {item.partNumber} — {item.componentName} (Qty:{" "}
                  {item.quantity})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="New Quantity" required>
            <input
              name="newQuantity"
              type="number"
              min="0"
              required
              className="input-base font-mono"
            />
          </FormField>
          <FormField label="Reason" required>
            <input
              name="reason"
              required
              placeholder="Physical count adjustment"
              className="input-base"
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowAdjust(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Adjust
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
