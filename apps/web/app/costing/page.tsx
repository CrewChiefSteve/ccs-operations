"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  PageHeader,
  DataTable,
  StatCard,
  LoadingState,
  EmptyState,
  Modal,
  FormField,
} from "@/components/ui";
import { PRODUCT_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Calculator, Package, DollarSign, TrendingUp, Save } from "lucide-react";

const PRODUCTS = [
  "Oil_Heater_Controller",
  "RaceScale",
  "Ride_Height_Sensor",
  "Tire_Temperature",
  "Tire-Temp-Probe",
];

export default function CostingPage() {
  const [selectedProduct, setSelectedProduct] = useState(PRODUCTS[0]);
  const [quantity, setQuantity] = useState(1);
  const [laborCost, setLaborCost] = useState("");
  const [overheadCost, setOverheadCost] = useState("");
  const [saveNotes, setSaveNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const cogsData = useQuery(api.inventory.costing.calculateProductCOGS, {
    productName: selectedProduct,
    quantity,
  });

  const costHistory = useQuery(api.inventory.costing.getProductCostHistory, {
    productName: selectedProduct,
    limit: 10,
  });

  const latestCosts = useQuery(api.inventory.costing.getLatestCostPerProduct);
  const saveCostSnapshot = useMutation(api.inventory.costing.saveCostSnapshot);

  const labor = parseFloat(laborCost) || 0;
  const overhead = parseFloat(overheadCost) || 0;
  const totalMaterial = cogsData?.materialCost ?? 0;
  const totalCost = totalMaterial + labor + overhead;
  const costPerUnit = quantity > 0 ? totalCost / quantity : 0;

  async function handleSave() {
    if (!cogsData) return;
    setSaving(true);
    try {
      await saveCostSnapshot({
        productName: selectedProduct,
        type: "estimate",
        bomVersion: cogsData.bomVersion,
        quantity,
        materialCost: totalMaterial,
        laborCost: labor || undefined,
        overheadCost: overhead || undefined,
        lineItems: cogsData.lineItems,
        calculatedBy: "dashboard",
        notes: saveNotes || undefined,
      });
      setSaveNotes("");
    } catch {
      // Error
    }
    setSaving(false);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cost of Goods (COGS)"
        description="Calculate and track production costs per product"
        actions={
          costHistory && costHistory.length > 0 ? (
            <button
              onClick={() => setShowHistory(true)}
              className="btn-secondary flex items-center gap-1.5 text-sm"
            >
              <TrendingUp size={14} />
              History ({costHistory.length})
            </button>
          ) : undefined
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        {latestCosts?.map((cost: { productName: string; costPerUnit: number; type: string }) => (
          <StatCard
            key={cost.productName}
            label={PRODUCT_LABELS[cost.productName] ?? cost.productName}
            value={formatCurrency(cost.costPerUnit)}
            subtitle={`per unit (${cost.type})`}
            icon={Package}
            accent={cost.productName === selectedProduct}
          />
        ))}
        {(!latestCosts || latestCosts.length === 0) && (
          <StatCard
            label="No cost data"
            value="—"
            subtitle="Calculate and save your first estimate"
            icon={Calculator}
          />
        )}
      </div>

      {/* Calculator */}
      <div className="card">
        <h3 className="text-sm font-semibold text-text-primary mb-4">
          COGS Calculator
        </h3>

        <div className="flex flex-wrap gap-4 items-end mb-6">
          <FormField label="Product">
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="input-base"
            >
              {PRODUCTS.map((p) => (
                <option key={p} value={p}>
                  {PRODUCT_LABELS[p] ?? p}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Quantity">
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="input-base w-24 text-center font-mono"
            />
          </FormField>

          <FormField label="Labor Cost ($)">
            <input
              type="number"
              min={0}
              step={0.01}
              value={laborCost}
              onChange={(e) => setLaborCost(e.target.value)}
              placeholder="0.00"
              className="input-base w-28 font-mono"
            />
          </FormField>

          <FormField label="Overhead ($)">
            <input
              type="number"
              min={0}
              step={0.01}
              value={overheadCost}
              onChange={(e) => setOverheadCost(e.target.value)}
              placeholder="0.00"
              className="input-base w-28 font-mono"
            />
          </FormField>
        </div>

        {/* BOM Cost Breakdown */}
        {cogsData === undefined ? (
          <LoadingState message="Calculating..." />
        ) : cogsData.lineItems.length === 0 ? (
          <EmptyState
            icon={Calculator}
            title="No BOM entries"
            description={`No BOM defined for ${PRODUCT_LABELS[selectedProduct] ?? selectedProduct}. Add components to the BOM first.`}
          />
        ) : (
          <>
            <div className="rounded-lg border border-surface-4 overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-4 bg-surface-2">
                    <th className="px-3 py-2 text-left text-2xs font-semibold uppercase text-text-tertiary">
                      Component
                    </th>
                    <th className="px-3 py-2 text-left text-2xs font-semibold uppercase text-text-tertiary">
                      Part Number
                    </th>
                    <th className="px-3 py-2 text-right text-2xs font-semibold uppercase text-text-tertiary">
                      Qty/Unit
                    </th>
                    <th className="px-3 py-2 text-right text-2xs font-semibold uppercase text-text-tertiary">
                      Unit Cost
                    </th>
                    <th className="px-3 py-2 text-right text-2xs font-semibold uppercase text-text-tertiary">
                      Line Total
                    </th>
                    <th className="px-3 py-2 text-2xs font-semibold uppercase text-text-tertiary">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cogsData.lineItems.map((li: { componentId: string; componentName: string; partNumber: string; quantityPerUnit: number; unitCost: number; totalCost: number; source: string }) => (
                    <tr
                      key={li.componentId}
                      className="border-b border-surface-4/50"
                    >
                      <td className="px-3 py-2 text-text-primary">
                        {li.componentName}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                        {li.partNumber}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-text-secondary">
                        {li.quantityPerUnit}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-text-primary">
                        {li.unitCost > 0 ? formatCurrency(li.unitCost) : (
                          <span className="text-amber-400">Unknown</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-medium text-text-primary">
                        {li.totalCost > 0 ? formatCurrency(li.totalCost) : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-2xs text-text-tertiary">
                          {li.source.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-2/50 border-t border-surface-4">
                    <td colSpan={4} className="px-3 py-2 text-xs font-medium text-text-secondary text-right">
                      Materials ({quantity} unit{quantity !== 1 ? "s" : ""})
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-semibold text-text-primary">
                      {formatCurrency(totalMaterial)}
                    </td>
                    <td />
                  </tr>
                  {labor > 0 && (
                    <tr className="bg-surface-2/50">
                      <td colSpan={4} className="px-3 py-1.5 text-xs text-text-secondary text-right">
                        Labor
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-text-primary">
                        {formatCurrency(labor)}
                      </td>
                      <td />
                    </tr>
                  )}
                  {overhead > 0 && (
                    <tr className="bg-surface-2/50">
                      <td colSpan={4} className="px-3 py-1.5 text-xs text-text-secondary text-right">
                        Overhead
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono text-text-primary">
                        {formatCurrency(overhead)}
                      </td>
                      <td />
                    </tr>
                  )}
                  <tr className="bg-accent/5 border-t border-accent/20">
                    <td colSpan={4} className="px-3 py-2.5 text-sm font-semibold text-accent text-right">
                      Total COGS
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-lg font-bold text-accent">
                      {formatCurrency(totalCost)}
                    </td>
                    <td />
                  </tr>
                  <tr className="bg-accent/5">
                    <td colSpan={4} className="px-3 py-1.5 text-xs text-accent/70 text-right">
                      Per unit
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono font-semibold text-accent">
                      {formatCurrency(costPerUnit)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>

            {cogsData.hasUnknownCosts && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-500/10 px-4 py-2.5 text-sm text-amber-400">
                <DollarSign size={14} />
                Some components have unknown costs. Add pricing via Suppliers or Pricing page.
              </div>
            )}

            {/* Save Estimate */}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-2xs font-medium text-text-tertiary">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={saveNotes}
                  onChange={(e) => setSaveNotes(e.target.value)}
                  placeholder="e.g., Initial estimate for Q1 production run"
                  className="input-base mt-1"
                />
              </div>
              <button
                onClick={handleSave}
                disabled={saving || cogsData.lineItems.length === 0}
                className="btn-primary flex items-center gap-1.5"
              >
                <Save size={14} />
                {saving ? "Saving..." : "Save Estimate"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Cost History Modal */}
      {showHistory && (
        <Modal
          open
          onClose={() => setShowHistory(false)}
          title={`Cost History — ${PRODUCT_LABELS[selectedProduct] ?? selectedProduct}`}
          size="lg"
        >
          {!costHistory || costHistory.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No cost history"
              description="Save an estimate to start tracking cost trends"
            />
          ) : (
            <DataTable
              data={costHistory as Array<{ calculatedAt: number; type: string; quantity: number; materialCost: number; costPerUnit: number; notes?: string }>}
              columns={[
                {
                  key: "calculatedAt",
                  header: "Date",
                  render: (c) => (
                    <span className="text-sm text-text-secondary">
                      {formatDate(c.calculatedAt)}
                    </span>
                  ),
                },
                {
                  key: "type",
                  header: "Type",
                  render: (c) => (
                    <span
                      className={`badge ${
                        c.type === "actual"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-blue-500/15 text-blue-400"
                      }`}
                    >
                      {c.type}
                    </span>
                  ),
                },
                {
                  key: "quantity",
                  header: "Qty",
                  render: (c) => (
                    <span className="font-mono text-text-secondary">{c.quantity}</span>
                  ),
                },
                {
                  key: "materialCost",
                  header: "Material",
                  render: (c) => (
                    <span className="font-mono text-text-primary">
                      {formatCurrency(c.materialCost)}
                    </span>
                  ),
                },
                {
                  key: "costPerUnit",
                  header: "Per Unit",
                  render: (c) => (
                    <span className="font-mono font-semibold text-accent">
                      {formatCurrency(c.costPerUnit)}
                    </span>
                  ),
                },
                {
                  key: "notes",
                  header: "Notes",
                  render: (c) => (
                    <span className="text-2xs text-text-tertiary">
                      {c.notes ?? "—"}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </Modal>
      )}
    </div>
  );
}
