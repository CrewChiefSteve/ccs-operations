"use client";

import { useState, FormEvent } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  PageHeader,
  DataTable,
  EmptyState,
  LoadingState,
  Modal,
  FormField,
} from "@/components/ui";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Truck, ExternalLink, Star } from "lucide-react";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supplier = {
  _id: any;
  name: string;
  website?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  accountNumber?: string;
  notes?: string;
  rating?: number;
  _creationTime: number;
  componentCount?: number;
};

export default function SuppliersPage() {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const suppliers = useQuery(api.inventory.suppliers.list, {
    search: search || undefined,
  });

  const createSupplier = useMutation(api.inventory.suppliers.create);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await createSupplier({
      name: form.get("name") as string,
      website: (form.get("website") as string) || undefined,
      contactName: (form.get("contactName") as string) || undefined,
      contactEmail: (form.get("contactEmail") as string) || undefined,
      contactPhone: (form.get("contactPhone") as string) || undefined,
      accountNumber: (form.get("accountNumber") as string) || undefined,
      notes: (form.get("notes") as string) || undefined,
      rating: Number(form.get("rating")) || undefined,
    });
    setShowAdd(false);
  }

  function RatingStars({ rating }: { rating?: number }) {
    if (!rating) return <span className="text-text-tertiary">—</span>;
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            size={12}
            className={cn(
              i <= rating
                ? "fill-amber-400 text-amber-400"
                : "text-surface-4"
            )}
          />
        ))}
      </div>
    );
  }

  const columns = [
    {
      key: "name",
      header: "Supplier",
      render: (row: Supplier) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-text-primary">{row.name}</span>
          {row.website && (
            <a
              href={row.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-tertiary hover:text-accent"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      className: "w-48",
      render: (row: Supplier) => (
        <div>
          <p className="text-text-primary">{row.contactName ?? "—"}</p>
          {row.contactEmail && (
            <p className="text-2xs text-text-tertiary">{row.contactEmail}</p>
          )}
        </div>
      ),
    },
    {
      key: "account",
      header: "Account #",
      className: "w-36",
      render: (row: Supplier) => (
        <span className="font-mono text-xs text-text-secondary">
          {row.accountNumber ?? "—"}
        </span>
      ),
    },
    {
      key: "rating",
      header: "Rating",
      className: "w-28",
      render: (row: Supplier) => <RatingStars rating={row.rating} />,
    },
    {
      key: "components",
      header: "Components",
      className: "w-28",
      render: (row: Supplier) => (
        <span className="text-text-secondary">
          {row.componentCount ?? 0} parts
        </span>
      ),
    },
    {
      key: "notes",
      header: "Notes",
      className: "w-48",
      render: (row: Supplier) => (
        <span className="text-text-tertiary line-clamp-1 text-xs">
          {row.notes ?? "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Supplier Directory"
        description={`${suppliers?.length ?? 0} suppliers`}
        actions={
          <button className="btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={14} />
            Add Supplier
          </button>
        }
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
        />
        <input
          type="text"
          placeholder="Search suppliers…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-base pl-9"
        />
      </div>

      {/* Table */}
      <div className="card-compact overflow-hidden p-0">
        {suppliers === undefined ? (
          <LoadingState />
        ) : suppliers.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No suppliers yet"
            description="Add your component suppliers to track pricing and lead times"
            action={
              <button
                className="btn-primary"
                onClick={() => setShowAdd(true)}
              >
                <Plus size={14} />
                Add Supplier
              </button>
            }
          />
        ) : (
          <DataTable columns={columns} data={suppliers} />
        )}
      </div>

      {/* Add Supplier Modal */}
      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Supplier"
        description="Add a new component supplier"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Company Name" required>
              <input
                name="name"
                required
                placeholder="DigiKey"
                className="input-base"
              />
            </FormField>
            <FormField label="Website">
              <input
                name="website"
                type="url"
                placeholder="https://www.digikey.com"
                className="input-base"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Contact Name">
              <input name="contactName" className="input-base" />
            </FormField>
            <FormField label="Contact Email">
              <input
                name="contactEmail"
                type="email"
                className="input-base"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Contact Phone">
              <input name="contactPhone" type="tel" className="input-base" />
            </FormField>
            <FormField label="Account Number">
              <input
                name="accountNumber"
                className="input-base font-mono"
              />
            </FormField>
          </div>

          <FormField label="Rating (1-5)">
            <select name="rating" className="input-base">
              <option value="">No rating</option>
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={r}>
                  {r} star{r !== 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Notes">
            <textarea
              name="notes"
              rows={2}
              placeholder="Internal notes about this supplier…"
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
              Add Supplier
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
