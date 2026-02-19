"use client";

import { useState, FormEvent } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import {
  PageHeader,
  DataTable,
  StatusBadge,
  EmptyState,
  LoadingState,
  Modal,
  FormField,
  StatCard,
} from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  Hammer,
  ChevronRight,
  CheckCircle2,
  XCircle,
  PackageCheck,
  AlertTriangle,
  Play,
  Square,
  ClipboardCheck,
  AlertCircle,
} from "lucide-react";
import {
  BUILD_STATUS_CONFIG,
  PRODUCTS,
  PRODUCT_LABELS,
} from "@/lib/constants";
import { formatDate, formatCurrency, generateBuildNumber } from "@/lib/utils";

// ============================================================
// TYPES
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BuildOrder = {
  _id: any;
  buildNumber: string;
  productName: string;
  product?: string;
  quantity: number;
  status: string;
  priority: string;
  bomVersion?: string;
  scheduledStart?: number;
  actualStart?: number;
  completedAt?: number;
  assignedTo?: string;
  qcStatus?: string;
  qcNotes?: string;
  notes?: string;
  _creationTime: number;
  updatedAt: number;
};

type BuildDetails = BuildOrder & {
  materials: MaterialLine[];
  feasibility: {
    canBuild: boolean;
    totalComponents: number;
    shortages: number;
    estimatedMaterialCost: number;
  };
  transactions: number;
};

type MaterialLine = {
  bomEntryId: string;
  componentId: string;
  componentName: string;
  partNumber: string;
  category?: string;
  quantityPerUnit: number;
  totalRequired: number;
  totalQuantity: number;
  totalAvailable: number;
  totalReserved: number;
  shortage: number;
  sufficient: boolean;
  isOptional?: boolean;
  referenceDesignator?: string;
  supplierName?: string;
  unitCost?: number;
  estimatedCost?: number;
  locations: Array<{
    locationId: string;
    inventoryId: string;
    locationName: string;
    locationCode: string;
    quantity: number;
    available: number;
    reserved: number;
  }>;
};

// ============================================================
// PAGE
// ============================================================

export default function BuildsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedBuildId, setSelectedBuildId] = useState<Id<"buildOrders"> | null>(null);

  const builds = useQuery(api.inventory.buildOrders.list, {
    search: search || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    product: productFilter === "all" ? undefined : productFilter,
  });

  const createBuild = useMutation(api.inventory.buildOrders.create);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await createBuild({
      buildNumber: generateBuildNumber(),
      product: form.get("product") as string,
      quantity: Number(form.get("quantity")),
      priority: (form.get("priority") as string) || "normal",
      notes: (form.get("notes") as string) || undefined,
    });
    setShowCreate(false);
  }

  // Summary stats
  const stats = builds
    ? {
        planned: builds.filter((b) => b.status === "planned").length,
        active: builds.filter((b) =>
          ["materials_reserved", "in_progress", "qc"].includes(b.status)
        ).length,
        complete: builds.filter((b) => b.status === "complete").length,
        total: builds.length,
      }
    : null;

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
            {PRODUCT_LABELS[row.productName] ?? PRODUCT_LABELS[row.product ?? ""] ?? row.productName}
          </p>
          {row.priority && row.priority !== "normal" && (
            <Badge
              className={
                row.priority === "high"
                  ? "bg-amber-500/15 text-amber-400"
                  : row.priority === "urgent"
                    ? "bg-red-500/15 text-red-400"
                    : "bg-surface-3 text-text-secondary"
              }
            >
              {row.priority}
            </Badge>
          )}
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
      key: "dates",
      header: "Created",
      className: "w-28",
      render: (row: BuildOrder) => (
        <span className="text-xs text-text-tertiary">
          {formatDate(row._creationTime)}
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

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          <StatCard
            label="Planned"
            value={stats.planned}
            icon={ClipboardCheck}
          />
          <StatCard
            label="Active"
            value={stats.active}
            icon={Play}
            accent
          />
          <StatCard
            label="Complete"
            value={stats.complete}
            icon={CheckCircle2}
          />
          <StatCard
            label="Total"
            value={stats.total}
            icon={Hammer}
          />
        </div>
      )}

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
            onRowClick={(row) => setSelectedBuildId(row._id as Id<"buildOrders">)}
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
            <FormField label="Priority">
              <select name="priority" className="input-base">
                <option value="normal">Normal</option>
                <option value="low">Low</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
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
      {selectedBuildId && (
        <BuildDetailModal
          buildId={selectedBuildId}
          onClose={() => setSelectedBuildId(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// BUILD DETAIL MODAL — Full material-aware workflow
// ============================================================

function BuildDetailModal({
  buildId,
  onClose,
}: {
  buildId: Id<"buildOrders">;
  onClose: () => void;
}) {
  const details = useQuery(api.inventory.buildWorkflow.getBuildDetails, {
    buildOrderId: buildId,
  }) as BuildDetails | null | undefined;

  const reserveMaterials = useMutation(api.inventory.buildWorkflow.reserveMaterials);
  const startBuild = useMutation(api.inventory.buildWorkflow.startBuild);
  const updateStatus = useMutation(api.inventory.buildOrders.updateStatus);
  const completeBuild = useMutation(api.inventory.buildWorkflow.completeBuild);
  const cancelBuild = useMutation(api.inventory.buildWorkflow.cancelBuild);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  async function handleAction(action: () => Promise<unknown>) {
    setSubmitting(true);
    setError(null);
    try {
      await action();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  }

  const productLabel = details
    ? PRODUCT_LABELS[details.productName] ?? PRODUCT_LABELS[details.product ?? ""] ?? details.productName
    : "";

  return (
    <Modal
      open
      onClose={onClose}
      title={details?.buildNumber ?? "Loading…"}
      description={details ? `${productLabel} × ${details.quantity}` : ""}
      size="lg"
    >
      {!details ? (
        <LoadingState message="Loading build details…" />
      ) : (
        <div className="space-y-5">
          {/* Status Bar */}
          <div className="flex items-center gap-4 rounded-lg bg-surface-2 px-4 py-3">
            <div>
              <span className="text-2xs text-text-tertiary">Status</span>
              <div className="mt-0.5">
                <StatusBadge status={details.status} config={BUILD_STATUS_CONFIG} />
              </div>
            </div>
            <div>
              <span className="text-2xs text-text-tertiary">Priority</span>
              <p className="mt-0.5 text-xs capitalize text-text-secondary">
                {details.priority}
              </p>
            </div>
            <div>
              <span className="text-2xs text-text-tertiary">Assigned</span>
              <p className="mt-0.5 text-xs text-text-secondary">
                {details.assignedTo ?? "Unassigned"}
              </p>
            </div>
            <div className="ml-auto text-right">
              <span className="text-2xs text-text-tertiary">Transactions</span>
              <p className="mt-0.5 font-mono text-xs text-text-secondary">
                {details.transactions}
              </p>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-2xs text-text-tertiary">Created</p>
              <p className="text-sm text-text-primary">
                {formatDate(details._creationTime)}
              </p>
            </div>
            <div>
              <p className="text-2xs text-text-tertiary">Started</p>
              <p className="text-sm text-text-primary">
                {details.actualStart ? formatDate(details.actualStart) : "Not started"}
              </p>
            </div>
            <div>
              <p className="text-2xs text-text-tertiary">Completed</p>
              <p className="text-sm text-text-primary">
                {details.completedAt ? formatDate(details.completedAt) : "—"}
              </p>
            </div>
          </div>

          {/* Feasibility Summary */}
          <FeasibilityPanel feasibility={details.feasibility} status={details.status} />

          {/* Materials BOM */}
          {details.materials.length > 0 && (
            <MaterialsTable materials={details.materials} />
          )}

          {/* Notes */}
          {details.notes && (
            <div>
              <p className="text-2xs text-text-tertiary">Notes</p>
              <p className="whitespace-pre-wrap text-sm text-text-secondary">
                {details.notes}
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-status-danger">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Workflow Actions */}
          {!["complete", "cancelled"].includes(details.status) && (
            <div className="flex items-center justify-between border-t border-surface-4 pt-4">
              {/* Cancel */}
              <div>
                {!cancelConfirm ? (
                  <button
                    className="btn-ghost text-status-danger"
                    onClick={() => setCancelConfirm(true)}
                    disabled={submitting}
                  >
                    <Square size={12} />
                    Cancel Build
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-status-danger">Are you sure?</span>
                    <button
                      className="btn-ghost text-status-danger"
                      onClick={() =>
                        handleAction(() =>
                          cancelBuild({ buildOrderId: buildId }).then(onClose)
                        )
                      }
                      disabled={submitting}
                    >
                      Yes, cancel
                    </button>
                    <button
                      className="btn-ghost"
                      onClick={() => setCancelConfirm(false)}
                    >
                      No
                    </button>
                  </div>
                )}
              </div>

              {/* Primary action by status */}
              <div className="flex gap-2">
                {details.status === "planned" && (
                  <button
                    className="btn-primary"
                    disabled={!details.feasibility.canBuild || submitting}
                    onClick={() =>
                      handleAction(() =>
                        reserveMaterials({ buildOrderId: buildId })
                      )
                    }
                    title={
                      !details.feasibility.canBuild
                        ? `${details.feasibility.shortages} component(s) insufficient`
                        : "Reserve all BOM materials"
                    }
                  >
                    <PackageCheck size={14} />
                    {submitting ? "Reserving…" : "Reserve Materials"}
                  </button>
                )}

                {details.status === "materials_reserved" && (
                  <button
                    className="btn-primary"
                    disabled={submitting}
                    onClick={() =>
                      handleAction(() =>
                        startBuild({ buildOrderId: buildId })
                      )
                    }
                  >
                    <Play size={14} />
                    {submitting ? "Starting…" : "Start Build"}
                  </button>
                )}

                {details.status === "in_progress" && (
                  <button
                    className="btn-primary"
                    disabled={submitting}
                    onClick={() =>
                      handleAction(() =>
                        updateStatus({ buildOrderId: buildId, status: "qc" })
                      )
                    }
                  >
                    <ClipboardCheck size={14} />
                    Move to QC
                  </button>
                )}

                {details.status === "qc" && (
                  <>
                    <button
                      className="btn-secondary"
                      disabled={submitting}
                      onClick={() =>
                        handleAction(() =>
                          updateStatus({ buildOrderId: buildId, status: "in_progress" })
                        )
                      }
                    >
                      Back to Build
                    </button>
                    <button
                      className="btn-primary"
                      disabled={submitting}
                      onClick={() =>
                        handleAction(() =>
                          completeBuild({ buildOrderId: buildId, qcStatus: "passed" })
                        )
                      }
                    >
                      <CheckCircle2 size={14} />
                      {submitting ? "Completing…" : "Complete Build"}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ============================================================
// FEASIBILITY PANEL
// ============================================================

function FeasibilityPanel({
  feasibility,
  status,
}: {
  feasibility: BuildDetails["feasibility"];
  status: string;
}) {
  const isPreReservation = status === "planned";

  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        feasibility.canBuild
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-amber-500/20 bg-amber-500/5"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {feasibility.canBuild ? (
            <CheckCircle2 size={16} className="text-status-success" />
          ) : (
            <AlertTriangle size={16} className="text-status-warning" />
          )}
          <span className="text-sm font-medium text-text-primary">
            {isPreReservation
              ? feasibility.canBuild
                ? "All materials available — ready to reserve"
                : `${feasibility.shortages} component${feasibility.shortages !== 1 ? "s" : ""} insufficient`
              : feasibility.canBuild
                ? "Materials secured"
                : `${feasibility.shortages} shortage${feasibility.shortages !== 1 ? "s" : ""}`}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-text-secondary">
            {feasibility.totalComponents} components
          </span>
          {feasibility.estimatedMaterialCost > 0 && (
            <span className="font-mono text-xs text-text-secondary">
              Est. {formatCurrency(feasibility.estimatedMaterialCost)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MATERIALS TABLE
// ============================================================

function MaterialsTable({ materials }: { materials: MaterialLine[] }) {
  const hasCosts = materials.some((m) => m.estimatedCost !== undefined);

  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
        Bill of Materials
      </h4>
      <div className="rounded-lg border border-surface-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-4 bg-surface-2">
              <th className="px-3 py-2 text-left text-2xs font-semibold uppercase text-text-tertiary">
                Component
              </th>
              <th className="px-3 py-2 text-right text-2xs font-semibold uppercase text-text-tertiary">
                Per Unit
              </th>
              <th className="px-3 py-2 text-right text-2xs font-semibold uppercase text-text-tertiary">
                Required
              </th>
              <th className="px-3 py-2 text-right text-2xs font-semibold uppercase text-text-tertiary">
                Available
              </th>
              <th className="px-3 py-2 text-right text-2xs font-semibold uppercase text-text-tertiary">
                Reserved
              </th>
              <th className="px-3 py-2 text-center text-2xs font-semibold uppercase text-text-tertiary">
                Status
              </th>
              {hasCosts && (
                <th className="px-3 py-2 text-right text-2xs font-semibold uppercase text-text-tertiary">
                  Cost
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {materials.map((mat) => (
              <tr key={mat.bomEntryId} className="border-b border-surface-4/50">
                <td className="px-3 py-2">
                  <div>
                    <p className="text-text-primary">
                      {mat.componentName}
                      {mat.isOptional && (
                        <span className="ml-1 text-2xs text-text-tertiary">(optional)</span>
                      )}
                    </p>
                    <p className="font-mono text-2xs text-text-tertiary">
                      {mat.partNumber}
                      {mat.referenceDesignator && ` · ${mat.referenceDesignator}`}
                    </p>
                  </div>
                </td>
                <td className="px-3 py-2 text-right font-mono text-text-secondary">
                  {mat.quantityPerUnit}
                </td>
                <td className="px-3 py-2 text-right font-mono font-medium text-text-primary">
                  {mat.totalRequired}
                </td>
                <td className="px-3 py-2 text-right font-mono text-text-secondary">
                  {mat.totalAvailable}
                </td>
                <td className="px-3 py-2 text-right font-mono text-text-secondary">
                  {mat.totalReserved}
                </td>
                <td className="px-3 py-2 text-center">
                  {mat.sufficient ? (
                    <span className="inline-flex items-center gap-1 text-2xs font-medium text-status-success">
                      <CheckCircle2 size={12} />
                      OK
                    </span>
                  ) : mat.isOptional ? (
                    <span className="text-2xs text-text-tertiary">—</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-2xs font-medium text-status-danger">
                      <XCircle size={12} />
                      Short {mat.shortage}
                    </span>
                  )}
                </td>
                {hasCosts && (
                  <td className="px-3 py-2 text-right font-mono text-2xs text-text-tertiary">
                    {mat.estimatedCost !== undefined
                      ? formatCurrency(mat.estimatedCost)
                      : "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
