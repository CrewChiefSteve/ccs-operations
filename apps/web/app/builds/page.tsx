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
import { Plus, Search, Hammer, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import {
  BUILD_STATUS_CONFIG,
  PRODUCTS,
  PRODUCT_LABELS,
} from "@/lib/constants";
import { formatDate, generateBuildNumber } from "@/lib/utils";

type BuildOrder = {
  _id: string;
  buildNumber: string;
  product: string;
  quantity: number;
  status: string;
  bomVersion: string;
  startDate?: number;
  completedDate?: number;
  assignedTo?: string;
  qcPassedCount?: number;
  qcFailedCount?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
};

export default function BuildsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedBuild, setSelectedBuild] = useState<BuildOrder | null>(null);

  const builds = useQuery(api.inventory.buildOrders.list, {
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    product: productFilter === "all" ? undefined : productFilter,
  });

  const createBuild = useMutation(api.inventory.buildOrders.create);
  const updateBuildStatus = useMutation(api.inventory.buildOrders.updateStatus);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await createBuild({
      buildNumber: generateBuildNumber(),
      product: form.get("product") as string,
      quantity: Number(form.get("quantity")),
      bomVersion: (form.get("bomVersion") as string) || "1.0",
      notes: (form.get("notes") as string) || undefined,
    });
    setShowCreate(false);
  }

  const statusTransitions: Record<string, string[]> = {
    planned: ["materials_reserved", "cancelled"],
    materials_reserved: ["in_progress", "cancelled"],
    in_progress: ["qc", "cancelled"],
    qc: ["complete", "in_progress"],
    complete: [],
    cancelled: [],
  };

  const columns = [
    {
      key: "buildNumber",
      header: "Build #",
      className: "w-40",
      render: (row: BuildOrder) => (
        <span className="font-mono text-xs font-medium text-accent">
          {row.buildNumber}
        </span>
      ),
    },
    {
      key: "product",
      header: "Product",
      render: (row: BuildOrder) => (
        <div>
          <p className="font-medium text-text-primary">
            {PRODUCT_LABELS[row.product] ?? row.product}
          </p>
          <p className="text-2xs text-text-tertiary">
            BOM v{row.bomVersion}
          </p>
        </div>
      ),
    },
    {
      key: "quantity",
      header: "Qty",
      className: "w-20 text-right",
      render: (row: BuildOrder) => (
        <span className="font-mono font-medium text-text-primary">
          {row.quantity}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      className: "w-40",
      render: (row: BuildOrder) => (
        <StatusBadge status={row.status} config={BUILD_STATUS_CONFIG} />
      ),
    },
    {
      key: "assignedTo",
      header: "Assigned",
      className: "w-28",
      render: (row: BuildOrder) => (
        <span className="text-text-secondary">
          {row.assignedTo ?? "Unassigned"}
        </span>
      ),
    },
    {
      key: "qc",
      header: "QC",
      className: "w-28",
      render: (row: BuildOrder) => {
        if (!row.qcPassedCount && !row.qcFailedCount)
          return <span className="text-text-tertiary">—</span>;
        return (
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-0.5 text-status-success">
              <CheckCircle2 size={12} />
              {row.qcPassedCount ?? 0}
            </span>
            {(row.qcFailedCount ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-status-danger">
                <XCircle size={12} />
                {row.qcFailedCount}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "dates",
      header: "Created",
      className: "w-28",
      render: (row: BuildOrder) => (
        <span className="text-xs text-text-tertiary">
          {formatDate(row.createdAt)}
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
        title="Build Orders"
        description={`${builds?.length ?? 0} build orders`}
        actions={
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} />
            New Build
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
            placeholder="Search builds…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-9"
          />
        </div>
        <select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="input-base w-48"
        >
          <option value="all">All Products</option>
          {PRODUCTS.map((p) => (
            <option key={p} value={p}>
              {PRODUCT_LABELS[p]}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-base w-44"
        >
          <option value="all">All Status</option>
          {Object.entries(BUILD_STATUS_CONFIG).map(([key, cfg]) => (
            <option key={key} value={key}>
              {cfg.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card-compact overflow-hidden p-0">
        {builds === undefined ? (
          <LoadingState />
        ) : builds.length === 0 ? (
          <EmptyState
            icon={Hammer}
            title="No build orders"
            description="Create a build order to start production tracking"
            action={
              <button
                className="btn-primary"
                onClick={() => setShowCreate(true)}
              >
                <Plus size={14} />
                New Build
              </button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={builds}
            onRowClick={(row) => setSelectedBuild(row)}
          />
        )}
      </div>

      {/* Create Build Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Build Order"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <FormField label="Product" required>
            <select name="product" required className="input-base">
              <option value="">Select product…</option>
              {PRODUCTS.map((p) => (
                <option key={p} value={p}>
                  {PRODUCT_LABELS[p]}
                </option>
              ))}
            </select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Quantity" required>
              <input
                name="quantity"
                type="number"
                min="1"
                required
                placeholder="10"
                className="input-base font-mono"
              />
            </FormField>
            <FormField label="BOM Version">
              <input
                name="bomVersion"
                placeholder="1.0"
                className="input-base font-mono"
              />
            </FormField>
          </div>
          <FormField label="Notes">
            <textarea
              name="notes"
              rows={2}
              placeholder="Build notes…"
              className="input-base resize-none"
            />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Create Build
            </button>
          </div>
        </form>
      </Modal>

      {/* Build Detail Modal */}
      <Modal
        open={!!selectedBuild}
        onClose={() => setSelectedBuild(null)}
        title={selectedBuild?.buildNumber ?? ""}
        description={`${PRODUCT_LABELS[selectedBuild?.product ?? ""] ?? selectedBuild?.product} — Qty ${selectedBuild?.quantity}`}
        size="lg"
      >
        {selectedBuild && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-2xs text-text-tertiary">Status</p>
                <StatusBadge
                  status={selectedBuild.status}
                  config={BUILD_STATUS_CONFIG}
                />
              </div>
              <div>
                <p className="text-2xs text-text-tertiary">BOM Version</p>
                <p className="font-mono text-sm text-text-primary">
                  v{selectedBuild.bomVersion}
                </p>
              </div>
              <div>
                <p className="text-2xs text-text-tertiary">Assigned To</p>
                <p className="text-sm text-text-primary">
                  {selectedBuild.assignedTo ?? "Unassigned"}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-2xs text-text-tertiary">Created</p>
                <p className="text-sm text-text-primary">
                  {formatDate(selectedBuild.createdAt)}
                </p>
              </div>
              <div>
                <p className="text-2xs text-text-tertiary">Started</p>
                <p className="text-sm text-text-primary">
                  {selectedBuild.startDate
                    ? formatDate(selectedBuild.startDate)
                    : "Not started"}
                </p>
              </div>
              <div>
                <p className="text-2xs text-text-tertiary">Completed</p>
                <p className="text-sm text-text-primary">
                  {selectedBuild.completedDate
                    ? formatDate(selectedBuild.completedDate)
                    : "—"}
                </p>
              </div>
            </div>

            {selectedBuild.notes && (
              <div>
                <p className="text-2xs text-text-tertiary">Notes</p>
                <p className="text-sm text-text-secondary">
                  {selectedBuild.notes}
                </p>
              </div>
            )}

            {statusTransitions[selectedBuild.status]?.length > 0 && (
              <div className="flex gap-2 border-t border-surface-4 pt-4">
                {statusTransitions[selectedBuild.status].map((nextStatus) => (
                  <button
                    key={nextStatus}
                    onClick={() =>
                      updateBuildStatus({
                        buildOrderId: selectedBuild._id,
                        status: nextStatus,
                      }).then(() => setSelectedBuild(null))
                    }
                    className={
                      nextStatus === "cancelled"
                        ? "btn-ghost text-status-danger"
                        : "btn-primary"
                    }
                  >
                    {nextStatus === "cancelled"
                      ? "Cancel Build"
                      : `Move to ${BUILD_STATUS_CONFIG[nextStatus]?.label ?? nextStatus}`}
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
