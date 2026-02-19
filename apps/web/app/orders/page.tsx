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
import { Plus, Search, ClipboardList, ChevronRight } from "lucide-react";
import { PO_STATUS_CONFIG } from "@/lib/constants";
import { formatDate, formatCurrency, generatePONumber } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PurchaseOrder = {
  _id: any;
  poNumber: string;
  supplierId: any;
  supplierName: string;
  status: string;
  orderDate?: number;
  expectedDelivery?: number;
  actualDelivery?: number;
  trackingNumber?: string;
  subtotal: number;
  shipping?: number;
  tax?: number;
  total: number;
  notes?: string;
  createdBy?: string;
  _creationTime?: number;
  lineItems?: Array<{
    componentName: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    quantityReceived: number;
  }>;
};

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  const orders = useQuery(api.inventory.purchaseOrders.list, {
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const suppliers = useQuery(api.inventory.suppliers.list, {});

  const createPO = useMutation(api.inventory.purchaseOrders.create);
  const updatePOStatus = useMutation(api.inventory.purchaseOrders.updateStatus);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await createPO({
      poNumber: generatePONumber(),
      supplierId: form.get("supplierId") as any,
      notes: (form.get("notes") as string) || undefined,
    });
    setShowCreate(false);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleStatusChange(poId: any, newStatus: string) {
    await updatePOStatus({ purchaseOrderId: poId, status: newStatus });
    setSelectedPO(null);
  }

  const statusTransitions: Record<string, string[]> = {
    draft: ["submitted", "cancelled"],
    submitted: ["confirmed", "cancelled"],
    confirmed: ["shipped", "cancelled"],
    shipped: ["received"],
    received: [],
    cancelled: [],
  };

  const columns = [
    {
      key: "poNumber",
      header: "PO Number",
      className: "w-36",
      render: (row: PurchaseOrder) => (
        <span className="font-mono text-xs font-medium text-accent">
          {row.poNumber}
        </span>
      ),
    },
    {
      key: "supplier",
      header: "Supplier",
      render: (row: PurchaseOrder) => (
        <span className="font-medium text-text-primary">
          {row.supplierName}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      className: "w-32",
      render: (row: PurchaseOrder) => (
        <StatusBadge status={row.status} config={PO_STATUS_CONFIG} />
      ),
    },
    {
      key: "total",
      header: "Total",
      className: "w-28 text-right",
      render: (row: PurchaseOrder) => (
        <span className="font-mono font-medium text-text-primary tabular-nums">
          {formatCurrency(row.total)}
        </span>
      ),
    },
    {
      key: "ordered",
      header: "Ordered",
      className: "w-28",
      render: (row: PurchaseOrder) => (
        <span className="text-xs text-text-tertiary">
          {row.orderDate ? formatDate(row.orderDate) : "—"}
        </span>
      ),
    },
    {
      key: "expected",
      header: "Expected",
      className: "w-28",
      render: (row: PurchaseOrder) => (
        <span className="text-xs text-text-tertiary">
          {row.expectedDelivery ? formatDate(row.expectedDelivery) : "—"}
        </span>
      ),
    },
    {
      key: "tracking",
      header: "Tracking",
      className: "w-36",
      render: (row: PurchaseOrder) => (
        <span className="font-mono text-2xs text-text-tertiary">
          {row.trackingNumber ?? "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-8",
      render: () => (
        <ChevronRight size={14} className="text-text-tertiary" />
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Purchase Orders"
        description={`${orders?.length ?? 0} orders`}
        actions={
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            New PO
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
            placeholder="Search POs…"
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
          {Object.entries(PO_STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>
              {cfg.label}
            </option>
          ))}
        </select>
      </div>

      {/* Status Summary Pills */}
      {orders && orders.length > 0 && (
        <div className="flex gap-2">
          {Object.entries(PO_STATUS_CONFIG).map(([key, cfg]) => {
            const count = orders.filter((o) => o.status === key).length;
            if (count === 0) return null;
            return (
              <button
                key={key}
                onClick={() =>
                  setStatusFilter(statusFilter === key ? "all" : key)
                }
                className={`badge cursor-pointer transition-colors ${
                  statusFilter === key
                    ? cfg.color
                    : "bg-surface-2 text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div className="card-compact overflow-hidden p-0">
        {orders === undefined ? (
          <LoadingState />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No purchase orders"
            description="Create your first purchase order to start tracking procurement"
            action={
              <button
                className="btn-primary"
                onClick={() => setShowCreate(true)}
              >
                <Plus size={14} />
                New PO
              </button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={orders}
            onRowClick={(row) => setSelectedPO(row)}
          />
        )}
      </div>

      {/* Create PO Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Purchase Order"
        description="Start a new purchase order as a draft"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <FormField label="Supplier" required>
            <select name="supplierId" required className="input-base">
              <option value="">Select supplier…</option>
              {suppliers?.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Notes">
            <textarea
              name="notes"
              rows={3}
              placeholder="PO notes, special instructions…"
              className="input-base resize-none"
            />
          </FormField>
          <p className="text-xs text-text-tertiary">
            Line items can be added after creating the PO.
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Create Draft PO
            </button>
          </div>
        </form>
      </Modal>

      {/* PO Detail Modal */}
      <Modal
        open={!!selectedPO}
        onClose={() => setSelectedPO(null)}
        title={selectedPO?.poNumber ?? ""}
        description={`${selectedPO?.supplierName ?? ""} — ${PO_STATUS_CONFIG[selectedPO?.status ?? ""]?.label ?? ""}`}
        size="lg"
      >
        {selectedPO && (
          <div className="space-y-5">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-2xs text-text-tertiary">Total</p>
                <p className="font-mono text-lg font-semibold text-text-primary">
                  {formatCurrency(selectedPO.total)}
                </p>
              </div>
              <div>
                <p className="text-2xs text-text-tertiary">Ordered</p>
                <p className="text-sm text-text-primary">
                  {selectedPO.orderDate
                    ? formatDate(selectedPO.orderDate)
                    : "Not yet"}
                </p>
              </div>
              <div>
                <p className="text-2xs text-text-tertiary">Expected Delivery</p>
                <p className="text-sm text-text-primary">
                  {selectedPO.expectedDelivery
                    ? formatDate(selectedPO.expectedDelivery)
                    : "TBD"}
                </p>
              </div>
            </div>

            {/* Line Items */}
            {selectedPO.lineItems && selectedPO.lineItems.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  Line Items
                </h4>
                <div className="rounded-lg border border-surface-4 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-4 bg-surface-2">
                        <th className="px-3 py-2 text-left text-2xs font-semibold uppercase text-text-tertiary">
                          Component
                        </th>
                        <th className="px-3 py-2 text-right text-2xs font-semibold uppercase text-text-tertiary">
                          Qty
                        </th>
                        <th className="px-3 py-2 text-right text-2xs font-semibold uppercase text-text-tertiary">
                          Unit Cost
                        </th>
                        <th className="px-3 py-2 text-right text-2xs font-semibold uppercase text-text-tertiary">
                          Total
                        </th>
                        <th className="px-3 py-2 text-right text-2xs font-semibold uppercase text-text-tertiary">
                          Received
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPO.lineItems.map((line, i) => (
                        <tr
                          key={i}
                          className="border-b border-surface-4/50"
                        >
                          <td className="px-3 py-2 text-text-primary">
                            {line.componentName}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-text-primary">
                            {line.quantity}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-text-secondary">
                            {formatCurrency(line.unitCost)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-text-primary">
                            {formatCurrency(line.totalCost)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-text-secondary">
                            {line.quantityReceived}/{line.quantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Notes */}
            {selectedPO.notes && (
              <div>
                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  Notes
                </h4>
                <p className="text-sm text-text-secondary">
                  {selectedPO.notes}
                </p>
              </div>
            )}

            {/* Status Actions */}
            {statusTransitions[selectedPO.status]?.length > 0 && (
              <div className="flex gap-2 border-t border-surface-4 pt-4">
                {statusTransitions[selectedPO.status].map((nextStatus) => (
                  <button
                    key={nextStatus}
                    onClick={() =>
                      handleStatusChange(selectedPO._id, nextStatus)
                    }
                    className={
                      nextStatus === "cancelled"
                        ? "btn-ghost text-status-danger"
                        : "btn-primary"
                    }
                  >
                    {nextStatus === "cancelled"
                      ? "Cancel PO"
                      : `Mark as ${PO_STATUS_CONFIG[nextStatus]?.label ?? nextStatus}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
