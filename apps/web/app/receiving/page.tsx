"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import {
  PageHeader,
  StatusBadge,
  EmptyState,
  LoadingState,
  Modal,
} from "@/components/ui";
import {
  PackageCheck,
  Truck,
  MapPin,
  Check,
  ChevronRight,
  PackageOpen,
  ClipboardCheck,
  AlertCircle,
} from "lucide-react";
import { PO_STATUS_CONFIG } from "@/lib/constants";
import { formatDate, formatCurrency } from "@/lib/utils";

// ============================================================
// TYPES
// ============================================================

type ReceivablePO = {
  _id: Id<"purchaseOrders">;
  poNumber: string;
  supplierName: string;
  status: string;
  expectedDelivery?: number;
  trackingNumber?: string;
  totalCost: number;
  lines: ReceivableLine[];
  totalOrdered: number;
  totalReceived: number;
};

type ReceivableLine = {
  _id: Id<"purchaseOrderLines">;
  componentId: Id<"components">;
  componentName: string;
  partNumber: string;
  quantityOrdered: number;
  quantityReceived: number;
  remaining: number;
  unitPrice: number;
  status: string;
  existingLocations?: Array<{
    locationId: Id<"locations">;
    locationName: string;
    locationCode: string;
    currentQty: number;
  }>;
};

type LineReceipt = {
  lineId: Id<"purchaseOrderLines">;
  quantityReceived: number;
  locationId: Id<"locations"> | "";
};

type ReceiveResult = {
  poNumber: string;
  newStatus: string;
  linesReceived: number;
  results: Array<{
    componentName: string;
    quantityReceived: number;
    newStockLevel: number;
    locationName: string;
  }>;
};

// ============================================================
// STATUS CONFIG (extends PO_STATUS_CONFIG with partial_received)
// ============================================================

const RECEIVING_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ...PO_STATUS_CONFIG,
  partial_received: {
    label: "Partial",
    color: "bg-amber-500/15 text-amber-400",
  },
};

// ============================================================
// PAGE
// ============================================================

export default function ReceivingPage() {
  const [selectedPO, setSelectedPO] = useState<Id<"purchaseOrders"> | null>(null);
  const [receiveResult, setReceiveResult] = useState<ReceiveResult | null>(null);

  const receivable = useQuery(api.inventory.receiving.getReceivable) as ReceivablePO[] | undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Receive Shipments"
        description={
          receivable
            ? `${receivable.length} shipment${receivable.length !== 1 ? "s" : ""} ready to receive`
            : "Loading…"
        }
      />

      {/* Receivable POs */}
      <div className="space-y-3">
        {receivable === undefined ? (
          <div className="card-compact">
            <LoadingState message="Loading receivable shipments…" />
          </div>
        ) : receivable.length === 0 ? (
          <div className="card-compact">
            <EmptyState
              icon={PackageCheck}
              title="No shipments to receive"
              description="When purchase orders are shipped or confirmed, they'll appear here for receiving"
            />
          </div>
        ) : (
          receivable.map((po) => (
            <POCard
              key={po._id}
              po={po}
              onClick={() => setSelectedPO(po._id)}
            />
          ))
        )}
      </div>

      {/* Receiving Modal */}
      {selectedPO && (
        <ReceivingModal
          poId={selectedPO}
          onClose={() => setSelectedPO(null)}
          onComplete={(result) => {
            setSelectedPO(null);
            setReceiveResult(result);
          }}
        />
      )}

      {/* Success Modal */}
      <Modal
        open={!!receiveResult}
        onClose={() => setReceiveResult(null)}
        title="Shipment Received"
        description={receiveResult?.poNumber ?? ""}
      >
        {receiveResult && <ReceiveSuccess result={receiveResult} onClose={() => setReceiveResult(null)} />}
      </Modal>
    </div>
  );
}

// ============================================================
// PO CARD — Clickable card for each receivable PO
// ============================================================

function POCard({ po, onClick }: { po: ReceivablePO; onClick: () => void }) {
  const progress = po.totalOrdered > 0
    ? Math.round((po.totalReceived / po.totalOrdered) * 100)
    : 0;

  const isOverdue = po.expectedDelivery && po.expectedDelivery < Date.now();

  return (
    <button
      onClick={onClick}
      className="card-compact group w-full text-left transition-colors hover:border-accent/40"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Icon */}
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Truck size={18} className="text-accent" />
          </div>

          {/* PO Info */}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-semibold text-accent">
                {po.poNumber}
              </span>
              <StatusBadge status={po.status} config={RECEIVING_STATUS_CONFIG} />
            </div>
            <p className="mt-0.5 text-xs text-text-secondary">
              {po.supplierName}
              {po.trackingNumber && (
                <span className="ml-2 font-mono text-2xs text-text-tertiary">
                  Track: {po.trackingNumber}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Expected Delivery */}
          <div className="text-right">
            <p className="text-2xs text-text-tertiary">Expected</p>
            <p className={`text-xs ${isOverdue ? "font-medium text-status-danger" : "text-text-secondary"}`}>
              {po.expectedDelivery ? formatDate(po.expectedDelivery) : "TBD"}
              {isOverdue && " (overdue)"}
            </p>
          </div>

          {/* Progress */}
          <div className="w-24">
            <div className="flex items-center justify-between">
              <span className="text-2xs text-text-tertiary">Received</span>
              <span className="font-mono text-2xs text-text-secondary">
                {po.totalReceived}/{po.totalOrdered}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-surface-3">
              <div
                className="h-1.5 rounded-full bg-accent transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Line count + total */}
          <div className="text-right">
            <p className="font-mono text-sm font-medium text-text-primary">
              {formatCurrency(po.totalCost)}
            </p>
            <p className="text-2xs text-text-tertiary">
              {po.lines.length} line{po.lines.length !== 1 ? "s" : ""}
            </p>
          </div>

          <ChevronRight
            size={16}
            className="text-text-tertiary transition-transform group-hover:translate-x-0.5"
          />
        </div>
      </div>
    </button>
  );
}

// ============================================================
// RECEIVING MODAL — The main receiving workflow
// ============================================================

function ReceivingModal({
  poId,
  onClose,
  onComplete,
}: {
  poId: Id<"purchaseOrders">;
  onClose: () => void;
  onComplete: (result: ReceiveResult) => void;
}) {
  const details = useQuery(api.inventory.receiving.getReceivingDetails, {
    purchaseOrderId: poId,
  }) as (ReceivablePO & { notes?: string }) | null | undefined;

  const locations = useQuery(api.inventory.locations.list, {});
  const receiveShipment = useMutation(api.inventory.receiving.receiveShipment);

  const [lineReceipts, setLineReceipts] = useState<Record<string, LineReceipt>>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize line receipts when details load
  if (details?.lines && Object.keys(lineReceipts).length === 0) {
    const initial: Record<string, LineReceipt> = {};
    for (const line of details.lines) {
      if (line.remaining > 0) {
        // Default: receive full remaining at existing location (if any)
        const suggestedLocation = line.existingLocations?.[0]?.locationId ?? "";
        initial[line._id] = {
          lineId: line._id,
          quantityReceived: line.remaining,
          locationId: suggestedLocation,
        };
      }
    }
    setLineReceipts(initial);
  }

  function updateLineReceipt(lineId: string, updates: Partial<LineReceipt>) {
    setLineReceipts((prev) => ({
      ...prev,
      [lineId]: { ...prev[lineId], ...updates },
    }));
  }

  async function handleSubmit() {
    if (!details) return;

    // Build receipt array (only lines with qty > 0 and a location)
    const receipts = Object.values(lineReceipts).filter(
      (r) => r.quantityReceived > 0 && r.locationId !== ""
    );

    if (receipts.length === 0) {
      setError("Select at least one line with a quantity and location");
      return;
    }

    // Validate all selected lines have locations
    const missingLocation = Object.values(lineReceipts).find(
      (r) => r.quantityReceived > 0 && r.locationId === ""
    );
    if (missingLocation) {
      setError("Please select a storage location for all items being received");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await receiveShipment({
        purchaseOrderId: poId,
        lineReceipts: receipts.map((r) => ({
          lineId: r.lineId,
          quantityReceived: r.quantityReceived,
          locationId: r.locationId as Id<"locations">,
        })),
        receivedBy: "dashboard",
        notes: notes || undefined,
      });

      onComplete(result as ReceiveResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to receive shipment");
    } finally {
      setSubmitting(false);
    }
  }

  const totalReceiving = Object.values(lineReceipts)
    .filter((r) => r.quantityReceived > 0 && r.locationId !== "")
    .reduce((sum, r) => sum + r.quantityReceived, 0);

  return (
    <Modal
      open
      onClose={onClose}
      title={details ? `Receive ${details.poNumber}` : "Loading…"}
      description={details ? `${details.supplierName} — ${details.lines?.length ?? 0} line items` : ""}
      size="lg"
    >
      {!details ? (
        <LoadingState message="Loading PO details…" />
      ) : (
        <div className="space-y-5">
          {/* PO Summary Bar */}
          <div className="flex items-center gap-4 rounded-lg bg-surface-2 px-4 py-3">
            <div className="flex-1">
              <span className="text-2xs text-text-tertiary">Status</span>
              <div className="mt-0.5">
                <StatusBadge status={details.status} config={RECEIVING_STATUS_CONFIG} />
              </div>
            </div>
            {details.trackingNumber && (
              <div className="flex-1">
                <span className="text-2xs text-text-tertiary">Tracking</span>
                <p className="mt-0.5 font-mono text-xs text-text-secondary">
                  {details.trackingNumber}
                </p>
              </div>
            )}
            <div>
              <span className="text-2xs text-text-tertiary">Expected</span>
              <p className="mt-0.5 text-xs text-text-secondary">
                {details.expectedDelivery ? formatDate(details.expectedDelivery) : "TBD"}
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xs text-text-tertiary">Total</span>
              <p className="mt-0.5 font-mono text-sm font-medium text-text-primary">
                {formatCurrency(details.totalCost)}
              </p>
            </div>
          </div>

          {/* Line Items */}
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Items to Receive
            </h4>
            <div className="space-y-2">
              {details.lines?.map((line) => {
                const receipt = lineReceipts[line._id];
                const isFullyReceived = line.remaining <= 0;

                return (
                  <div
                    key={line._id}
                    className={`rounded-lg border px-4 py-3 ${
                      isFullyReceived
                        ? "border-surface-4/50 bg-surface-2/30 opacity-60"
                        : "border-surface-4 bg-surface-2"
                    }`}
                  >
                    {/* Component info row */}
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {line.componentName}
                        </p>
                        <p className="font-mono text-2xs text-text-tertiary">
                          {line.partNumber}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-xs text-text-secondary">
                          {line.quantityReceived}/{line.quantityOrdered} received
                        </p>
                        <p className="font-mono text-2xs text-text-tertiary">
                          {formatCurrency(line.unitPrice)}/ea
                        </p>
                      </div>
                    </div>

                    {/* Receiving controls (only for lines with remaining) */}
                    {!isFullyReceived && receipt && (
                      <div className="mt-3 flex items-end gap-3 border-t border-surface-4/50 pt-3">
                        {/* Quantity */}
                        <div className="w-28">
                          <label className="text-2xs font-medium text-text-tertiary">
                            Qty to receive
                          </label>
                          <div className="mt-1 flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={line.remaining}
                              value={receipt.quantityReceived}
                              onChange={(e) =>
                                updateLineReceipt(line._id, {
                                  quantityReceived: Math.min(
                                    parseInt(e.target.value) || 0,
                                    line.remaining
                                  ),
                                })
                              }
                              className="input-base w-full text-center font-mono"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                updateLineReceipt(line._id, {
                                  quantityReceived: line.remaining,
                                })
                              }
                              className="btn-ghost whitespace-nowrap text-2xs text-accent"
                              title="Receive all remaining"
                            >
                              All ({line.remaining})
                            </button>
                          </div>
                        </div>

                        {/* Location */}
                        <div className="flex-1">
                          <label className="text-2xs font-medium text-text-tertiary">
                            <MapPin size={10} className="mr-0.5 inline" />
                            Storage location
                          </label>
                          <select
                            value={receipt.locationId}
                            onChange={(e) =>
                              updateLineReceipt(line._id, {
                                locationId: e.target.value as Id<"locations"> | "",
                              })
                            }
                            className="input-base mt-1"
                          >
                            <option value="">Select location…</option>
                            {/* Suggested locations (existing stock) first */}
                            {line.existingLocations && line.existingLocations.length > 0 && (
                              <optgroup label="Current stock locations">
                                {line.existingLocations.map((loc) => (
                                  <option key={loc.locationId} value={loc.locationId}>
                                    {loc.locationName} ({loc.locationCode}) — {loc.currentQty} in stock
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {/* All locations */}
                            <optgroup label="All locations">
                              {locations?.map((loc) => (
                                <option key={loc._id} value={loc._id}>
                                  {loc.name} ({loc.code})
                                </option>
                              ))}
                            </optgroup>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Already received badge */}
                    {isFullyReceived && (
                      <div className="mt-2 flex items-center gap-1 text-status-success">
                        <Check size={12} />
                        <span className="text-2xs font-medium">Fully received</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-text-secondary">
              Receiving notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Condition of shipment, discrepancies, etc."
              className="input-base mt-1 resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-status-danger">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-surface-4 pt-4">
            <p className="text-xs text-text-secondary">
              {totalReceiving > 0
                ? `Receiving ${totalReceiving} item${totalReceiving !== 1 ? "s" : ""}`
                : "No items selected"}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                className="btn-secondary"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={totalReceiving === 0 || submitting}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <>Processing…</>
                ) : (
                  <>
                    <PackageOpen size={14} />
                    Confirm Receipt
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ============================================================
// SUCCESS SUMMARY — What just happened
// ============================================================

function ReceiveSuccess({
  result,
  onClose,
}: {
  result: ReceiveResult;
  onClose: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Success header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15">
          <ClipboardCheck size={20} className="text-status-success" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">
            {result.linesReceived} line{result.linesReceived !== 1 ? "s" : ""} received successfully
          </p>
          <p className="text-xs text-text-secondary">
            PO status: <span className="font-medium text-text-primary">{result.newStatus.replace("_", " ")}</span>
          </p>
        </div>
      </div>

      {/* Items received */}
      <div className="rounded-lg border border-surface-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-4 bg-surface-2">
              <th className="px-3 py-2 text-left text-2xs font-semibold uppercase text-text-tertiary">
                Component
              </th>
              <th className="px-3 py-2 text-right text-2xs font-semibold uppercase text-text-tertiary">
                Received
              </th>
              <th className="px-3 py-2 text-left text-2xs font-semibold uppercase text-text-tertiary">
                Location
              </th>
              <th className="px-3 py-2 text-right text-2xs font-semibold uppercase text-text-tertiary">
                New Stock
              </th>
            </tr>
          </thead>
          <tbody>
            {result.results.map((item, i) => (
              <tr key={i} className="border-b border-surface-4/50">
                <td className="px-3 py-2 text-text-primary">
                  {item.componentName}
                </td>
                <td className="px-3 py-2 text-right font-mono font-medium text-status-success">
                  +{item.quantityReceived}
                </td>
                <td className="px-3 py-2 text-text-secondary">
                  {item.locationName}
                </td>
                <td className="px-3 py-2 text-right font-mono text-text-primary">
                  {item.newStockLevel}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end pt-2">
        <button className="btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
