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
import { Plus, Search, Cpu, ExternalLink } from "lucide-react";
import { COMPONENT_CATEGORIES, CATEGORY_LABELS } from "@/lib/constants";
import { formatDate, cn } from "@/lib/utils";

type Component = {
  _id: string;
  partNumber: string;
  name: string;
  category: string;
  subcategory?: string;
  manufacturer?: string;
  manufacturerPN?: string;
  description?: string;
  unitOfMeasure: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
};

export default function CatalogPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);

  const components = useQuery(api.inventory.components.list, {
    search: search || undefined,
    category: categoryFilter === "all" ? undefined : categoryFilter,
  });

  const createComponent = useMutation(api.inventory.components.create);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await createComponent({
      partNumber: form.get("partNumber") as string,
      name: form.get("name") as string,
      category: form.get("category") as string,
      subcategory: (form.get("subcategory") as string) || undefined,
      manufacturer: (form.get("manufacturer") as string) || undefined,
      manufacturerPN: (form.get("manufacturerPN") as string) || undefined,
      description: (form.get("description") as string) || undefined,
      unitOfMeasure: (form.get("unitOfMeasure") as string) || "each",
    });
    setShowAdd(false);
  }

  const columns = [
    {
      key: "partNumber",
      header: "Part Number",
      className: "w-40",
      render: (row: Component) => (
        <span className="font-mono text-xs font-medium text-accent">
          {row.partNumber}
        </span>
      ),
    },
    {
      key: "name",
      header: "Name",
      render: (row: Component) => (
        <div>
          <p className="font-medium text-text-primary">{row.name}</p>
          {row.description && (
            <p className="mt-0.5 text-2xs text-text-tertiary line-clamp-1">
              {row.description}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      className: "w-32",
      render: (row: Component) => (
        <Badge className="bg-surface-3 text-text-secondary">
          {CATEGORY_LABELS[row.category] ?? row.category}
        </Badge>
      ),
    },
    {
      key: "manufacturer",
      header: "Manufacturer",
      className: "w-40",
      render: (row: Component) => (
        <div>
          <p className="text-text-primary">{row.manufacturer ?? "—"}</p>
          {row.manufacturerPN && (
            <p className="text-2xs font-mono text-text-tertiary">
              {row.manufacturerPN}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "uom",
      header: "UoM",
      className: "w-20",
      render: (row: Component) => (
        <span className="text-text-secondary">{row.unitOfMeasure}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      className: "w-24",
      render: (row: Component) => (
        <Badge
          className={
            row.isActive
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-surface-3 text-text-tertiary"
          }
        >
          {row.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "updated",
      header: "Updated",
      className: "w-28",
      render: (row: Component) => (
        <span className="text-text-tertiary text-xs">
          {formatDate(row.updatedAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Component Catalog"
        description={`${components?.length ?? 0} components tracked`}
        actions={
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={14} />
            Add Component
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
            placeholder="Search components…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base pl-9"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="input-base w-40"
        >
          <option value="all">All Categories</option>
          {COMPONENT_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card-compact overflow-hidden p-0">
        {components === undefined ? (
          <LoadingState />
        ) : components.length === 0 ? (
          <EmptyState
            icon={Cpu}
            title="No components found"
            description={
              search
                ? "Try a different search term"
                : "Add your first component to get started"
            }
            action={
              !search && (
                <button
                  className="btn-primary"
                  onClick={() => setShowAdd(true)}
                >
                  <Plus size={14} />
                  Add Component
                </button>
              )
            }
          />
        ) : (
          <DataTable columns={columns} data={components} />
        )}
      </div>

      {/* Add Component Modal */}
      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Component"
        description="Add a new component to the catalog"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Part Number" required>
              <input
                name="partNumber"
                required
                placeholder="CCS-MCU-001"
                className="input-base font-mono"
              />
            </FormField>
            <FormField label="Name" required>
              <input
                name="name"
                required
                placeholder="ESP32-C3 SuperMini"
                className="input-base"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Category" required>
              <select name="category" required className="input-base">
                {COMPONENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Subcategory">
              <input
                name="subcategory"
                placeholder="thermocouple_interface"
                className="input-base"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Manufacturer">
              <input
                name="manufacturer"
                placeholder="Espressif"
                className="input-base"
              />
            </FormField>
            <FormField label="Manufacturer P/N">
              <input
                name="manufacturerPN"
                placeholder="ESP32-C3-MINI-1"
                className="input-base font-mono"
              />
            </FormField>
          </div>

          <FormField label="Unit of Measure">
            <select name="unitOfMeasure" className="input-base">
              <option value="each">Each</option>
              <option value="meter">Meter</option>
              <option value="kg">Kilogram</option>
              <option value="liter">Liter</option>
            </select>
          </FormField>

          <FormField label="Description">
            <textarea
              name="description"
              rows={2}
              placeholder="Brief description of the component…"
              className="input-base resize-none"
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowAdd(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Add Component
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
