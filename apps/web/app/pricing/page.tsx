"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import {
  PageHeader,
  DataTable,
  StatusBadge,
  LoadingState,
  EmptyState,
  Modal,
  FormField,
} from "@/components/ui";
import { SUPPLIER_PROVIDER_CONFIG } from "@/lib/constants";
import { formatCurrency, formatRelativeTime } from "@/lib/utils";
import {
  DollarSign,
  RefreshCw,
  ExternalLink,
  Settings,
  Search,
  AlertCircle,
  Star,
} from "lucide-react";

export default function PricingPage() {
  const [selectedComponentId, setSelectedComponentId] =
    useState<Id<"components"> | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);

  const components = useQuery(api.inventory.components.list, {});
  const configs = useQuery(api.inventory.supplierApi.listConfigs);

  const configuredCount = configs?.filter((c) => c.isConfigured).length ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Supplier Pricing"
        description="Compare component pricing across suppliers"
        actions={
          <button
            onClick={() => setConfigModalOpen(true)}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <Settings size={14} />
            API Config
            {configuredCount > 0 && (
              <span className="ml-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-2xs text-emerald-400">
                {configuredCount} active
              </span>
            )}
          </button>
        }
      />

      {/* API Status Banner */}
      {configs && configuredCount === 0 && (
        <div className="flex items-center gap-3 rounded-lg bg-amber-500/10 px-4 py-3">
          <AlertCircle size={16} className="text-amber-400 flex-shrink-0" />
          <div className="text-sm">
            <span className="font-medium text-amber-400">
              No supplier APIs configured.
            </span>{" "}
            <span className="text-text-secondary">
              Pricing data comes from manual entries in component-supplier
              records. Configure API keys to enable live pricing from DigiKey,
              Mouser, or LCSC.
            </span>
          </div>
        </div>
      )}

      {/* Component List */}
      {components === undefined ? (
        <LoadingState message="Loading components..." />
      ) : components.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No components"
          description="Add components to the catalog to see pricing data"
        />
      ) : (
        <DataTable
          data={components}
          columns={[
            {
              key: "partNumber",
              header: "Part Number",
              render: (c) => (
                <span className="font-mono text-sm text-accent">
                  {c.partNumber}
                </span>
              ),
            },
            {
              key: "name",
              header: "Component",
              render: (c) => (
                <div>
                  <div className="text-sm text-text-primary">{c.name}</div>
                  {c.manufacturer && (
                    <div className="text-2xs text-text-tertiary">
                      {c.manufacturer}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: "category",
              header: "Category",
              render: (c) => (
                <span className="text-xs text-text-secondary">{c.category}</span>
              ),
            },
            {
              key: "actions",
              header: "",
              className: "w-32",
              render: (c) => (
                <button
                  onClick={() => setSelectedComponentId(c._id)}
                  className="btn-ghost text-2xs flex items-center gap-1"
                >
                  <Search size={12} />
                  View Pricing
                </button>
              ),
            },
          ]}
          onRowClick={(c) => setSelectedComponentId(c._id)}
        />
      )}

      {/* Component Pricing Detail Modal */}
      {selectedComponentId && (
        <PricingDetailModal
          componentId={selectedComponentId}
          onClose={() => setSelectedComponentId(null)}
        />
      )}

      {/* API Config Modal */}
      {configModalOpen && (
        <ApiConfigModal onClose={() => setConfigModalOpen(false)} />
      )}
    </div>
  );
}

// ============================================================
// PRICING DETAIL MODAL
// ============================================================

function PricingDetailModal({
  componentId,
  onClose,
}: {
  componentId: Id<"components">;
  onClose: () => void;
}) {
  const data = useQuery(api.inventory.supplierApi.getComponentPricing, {
    componentId,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={data?.component?.name ?? "Loading..."}
      description={
        data?.component
          ? `${data.component.partNumber} — ${data.component.manufacturer ?? "Unknown manufacturer"}`
          : ""
      }
      size="lg"
    >
      {!data ? (
        <LoadingState message="Loading pricing..." />
      ) : data.pricing.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title="No supplier links"
          description="Add suppliers for this component in the catalog to see pricing"
        />
      ) : (
        <div className="space-y-4">
          {/* Pricing Table */}
          <div className="rounded-lg border border-surface-4 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-4 bg-surface-2">
                  <th className="px-3 py-2 text-left text-2xs font-semibold uppercase text-text-tertiary">
                    Supplier
                  </th>
                  <th className="px-3 py-2 text-left text-2xs font-semibold uppercase text-text-tertiary">
                    Part Number
                  </th>
                  <th className="px-3 py-2 text-right text-2xs font-semibold uppercase text-text-tertiary">
                    Unit Price
                  </th>
                  <th className="px-3 py-2 text-right text-2xs font-semibold uppercase text-text-tertiary">
                    MOQ
                  </th>
                  <th className="px-3 py-2 text-right text-2xs font-semibold uppercase text-text-tertiary">
                    Lead Time
                  </th>
                  <th className="px-3 py-2 text-center text-2xs font-semibold uppercase text-text-tertiary">
                    API
                  </th>
                  <th className="px-3 py-2 text-2xs font-semibold uppercase text-text-tertiary">
                    Updated
                  </th>
                  <th className="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {data.pricing.map((p) => (
                  <tr
                    key={p._id}
                    className="border-b border-surface-4/50 hover:bg-surface-2/50"
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {p.isPreferred && (
                          <Star size={10} className="text-amber-400 fill-amber-400" />
                        )}
                        <span className="text-text-primary font-medium">
                          {p.supplierName}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-text-secondary">
                      {p.supplierPartNumber ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-medium text-text-primary">
                      {p.unitPrice != null
                        ? formatCurrency(p.unitPrice)
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-text-secondary">
                      {p.minOrderQty ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-text-secondary">
                      {p.leadTimeDays != null ? `${p.leadTimeDays}d` : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <StatusBadge
                        status={p.apiProvider}
                        config={SUPPLIER_PROVIDER_CONFIG}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-text-tertiary text-2xs">
                      {formatRelativeTime(p.lastPriceCheck)}
                    </td>
                    <td className="px-3 py-2.5">
                      {p.url && (
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text-tertiary hover:text-accent transition-colors"
                          title="Open supplier page"
                        >
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* In Stock Status */}
          {data.pricing.some((p) => p.inStock !== undefined) && (
            <div className="text-2xs text-text-tertiary">
              Stock availability:{" "}
              {data.pricing
                .filter((p) => p.inStock !== undefined)
                .map(
                  (p) =>
                    `${p.supplierName}: ${p.inStock ? "In Stock" : "Out of Stock"}`
                )
                .join(" | ")}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ============================================================
// API CONFIG MODAL
// ============================================================

function ApiConfigModal({ onClose }: { onClose: () => void }) {
  const suppliers = useQuery(api.inventory.suppliers.list, {});
  const configs = useQuery(api.inventory.supplierApi.listConfigs);
  const upsertConfig = useMutation(api.inventory.supplierApi.upsertConfig);
  const [editing, setEditing] = useState<{
    supplierId: Id<"suppliers">;
    supplierName: string;
    provider: string;
    clientId: string;
    apiKey: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await upsertConfig({
        supplierId: editing.supplierId,
        provider: editing.provider as "digikey" | "mouser" | "lcsc" | "manual",
        clientId: editing.clientId || undefined,
        apiKeyEncrypted: editing.apiKey || undefined,
      });
      setEditing(null);
    } catch {
      // Error handling
    }
    setSaving(false);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Supplier API Configuration"
      description="Configure API keys for automated pricing lookups"
      size="lg"
    >
      {!suppliers || !configs ? (
        <LoadingState message="Loading..." />
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-surface-4 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-4 bg-surface-2">
                  <th className="px-3 py-2 text-left text-2xs font-semibold uppercase text-text-tertiary">
                    Supplier
                  </th>
                  <th className="px-3 py-2 text-left text-2xs font-semibold uppercase text-text-tertiary">
                    Provider
                  </th>
                  <th className="px-3 py-2 text-center text-2xs font-semibold uppercase text-text-tertiary">
                    Status
                  </th>
                  <th className="px-3 py-2 text-2xs font-semibold uppercase text-text-tertiary">
                    Last Sync
                  </th>
                  <th className="px-3 py-2 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((supplier) => {
                  const config = configs.find(
                    (c) => c.supplierId === supplier._id
                  );
                  return (
                    <tr
                      key={supplier._id}
                      className="border-b border-surface-4/50"
                    >
                      <td className="px-3 py-2.5 font-medium text-text-primary">
                        {supplier.name}
                      </td>
                      <td className="px-3 py-2.5">
                        {config ? (
                          <StatusBadge
                            status={config.provider}
                            config={SUPPLIER_PROVIDER_CONFIG}
                          />
                        ) : (
                          <span className="text-text-tertiary text-xs">
                            Not configured
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {config?.isConfigured ? (
                          <span className="inline-flex items-center gap-1 text-2xs text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                        ) : (
                          <span className="text-2xs text-text-tertiary">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-2xs text-text-tertiary">
                        {config?.lastSyncAt
                          ? formatRelativeTime(config.lastSyncAt)
                          : "Never"}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() =>
                            setEditing({
                              supplierId: supplier._id,
                              supplierName: supplier.name,
                              provider: config?.provider ?? "manual",
                              clientId: "",
                              apiKey: "",
                            })
                          }
                          className="btn-ghost text-2xs"
                        >
                          Configure
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-2xs text-text-tertiary">
            API credentials are stored server-side and never exposed to the
            browser. Contact suppliers for API access: DigiKey (developer.digikey.com),
            Mouser (api.mouser.com).
          </p>
        </div>
      )}

      {/* Edit Config Modal */}
      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={`Configure ${editing.supplierName}`}
          size="sm"
        >
          <div className="space-y-4">
            <FormField label="API Provider" required>
              <select
                value={editing.provider}
                onChange={(e) =>
                  setEditing({ ...editing, provider: e.target.value })
                }
                className="input-base"
              >
                <option value="digikey">DigiKey</option>
                <option value="mouser">Mouser</option>
                <option value="lcsc">LCSC</option>
                <option value="manual">Manual (no API)</option>
              </select>
            </FormField>

            {editing.provider !== "manual" && (
              <>
                <FormField label="Client ID / API Key">
                  <input
                    type="text"
                    value={editing.clientId}
                    onChange={(e) =>
                      setEditing({ ...editing, clientId: e.target.value })
                    }
                    placeholder="Enter API key or Client ID"
                    className="input-base"
                  />
                </FormField>

                {editing.provider === "digikey" && (
                  <FormField label="Client Secret">
                    <input
                      type="password"
                      value={editing.apiKey}
                      onChange={(e) =>
                        setEditing({ ...editing, apiKey: e.target.value })
                      }
                      placeholder="Enter Client Secret"
                      className="input-base"
                    />
                  </FormField>
                )}
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditing(null)}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary text-sm"
              >
                {saving ? "Saving..." : "Save Configuration"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
