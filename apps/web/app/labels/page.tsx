"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { QRCodeSVG } from "qrcode.react";

type LabelType = "location" | "component" | "purchase_order" | "build_order";

interface Label {
  type: LabelType;
  qrValue: string;
  line1: string;
  line2: string;
  line3?: string;
}

export default function LabelsPage() {
  const [labelType, setLabelType] = useState<LabelType>("location");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [labelSize, setLabelSize] = useState<"small" | "medium" | "large">(
    "medium"
  );
  const [copies, setCopies] = useState(1);

  const locations = useQuery(api.inventory.locations.list, {});
  const components = useQuery(api.inventory.components.list, {});
  const purchaseOrders = useQuery(api.inventory.purchaseOrders.list, {});
  const buildOrders = useQuery(api.inventory.buildOrders.list, {});

  const items =
    labelType === "location"
      ? locations
      : labelType === "component"
        ? components
        : labelType === "purchase_order"
          ? purchaseOrders
          : buildOrders;

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!items) return;
    setSelectedIds(new Set(items.map((i: Record<string, unknown>) => i._id as string)));
  };

  const selectNone = () => setSelectedIds(new Set());

  const baseLabels: Label[] = (items ?? [])
    .filter((item: Record<string, unknown>) => selectedIds.has(item._id as string))
    .map((item: Record<string, unknown>): Label => {
      if (labelType === "location") {
        const loc = item as {
          _id: string;
          name: string;
          type: string;
          description?: string;
        };
        return {
          type: "location",
          qrValue: loc._id,
          line1: loc.name,
          line2: loc.type.toUpperCase(),
          line3: loc.description,
        };
      } else if (labelType === "component") {
        const comp = item as {
          _id: string;
          partNumber: string;
          name: string;
          category: string;
        };
        return {
          type: "component",
          qrValue: comp.partNumber,
          line1: comp.partNumber,
          line2: comp.name,
          line3: comp.category,
        };
      } else if (labelType === "purchase_order") {
        const po = item as {
          _id: string;
          poNumber: string;
          supplierName: string;
          status: string;
        };
        return {
          type: "purchase_order",
          qrValue: `PO:${po.poNumber}`,
          line1: po.poNumber,
          line2: po.supplierName,
          line3: po.status.replace("_", " "),
        };
      } else {
        const build = item as {
          _id: string;
          buildNumber: string;
          productName: string;
          quantity: number;
        };
        return {
          type: "build_order",
          qrValue: `BUILD:${build.buildNumber}`,
          line1: build.buildNumber,
          line2: build.productName.replace(/_/g, " "),
          line3: `Qty: ${build.quantity}`,
        };
      }
    });

  // Expand labels by copy count
  const labels: Label[] = baseLabels.flatMap((label) =>
    Array.from({ length: copies }, () => label)
  );

  const qrSize =
    labelSize === "small" ? 80 : labelSize === "medium" ? 120 : 160;
  const labelClass =
    labelSize === "small"
      ? "w-[2in] h-[1in]"
      : labelSize === "medium"
        ? "w-[2.5in] h-[1.25in]"
        : "w-[3in] h-[1.5in]";

  // Helper to get display fields for the item list
  function getItemSubtext(item: Record<string, unknown>): {
    mono: string;
    label: string;
  } {
    switch (labelType) {
      case "component":
        return { mono: item.partNumber as string, label: item.name as string };
      case "location":
        return { mono: item.type as string, label: item.name as string };
      case "purchase_order":
        return {
          mono: item.poNumber as string,
          label: (item.supplierName as string) ?? "",
        };
      case "build_order":
        return {
          mono: item.buildNumber as string,
          label: ((item.productName as string) ?? "").replace(/_/g, " "),
        };
      default:
        return { mono: "", label: item.name as string };
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Controls — hidden when printing */}
      <div className="print:hidden p-6 border-b bg-gray-50">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">
          QR Label Generator
        </h1>

        <div className="flex flex-wrap gap-4 items-center mb-4">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Label Type
            </label>
            <select
              value={labelType}
              onChange={(e) => {
                setLabelType(e.target.value as LabelType);
                setSelectedIds(new Set());
              }}
              className="ml-2 border rounded px-3 py-1.5 text-sm text-gray-900"
            >
              <option value="location">Locations</option>
              <option value="component">Components</option>
              <option value="purchase_order">Purchase Orders</option>
              <option value="build_order">Build Orders</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Size</label>
            <select
              value={labelSize}
              onChange={(e) =>
                setLabelSize(e.target.value as "small" | "medium" | "large")
              }
              className="ml-2 border rounded px-3 py-1.5 text-sm text-gray-900"
            >
              <option value="small">Small (2&quot; &times; 1&quot;)</option>
              <option value="medium">
                Medium (2.5&quot; &times; 1.25&quot;)
              </option>
              <option value="large">Large (3&quot; &times; 1.5&quot;)</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Copies</label>
            <input
              type="number"
              min={1}
              max={20}
              value={copies}
              onChange={(e) =>
                setCopies(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))
              }
              className="ml-2 border rounded px-3 py-1.5 text-sm text-gray-900 w-16 text-center"
            />
          </div>

          <button
            onClick={selectAll}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Select All
          </button>
          <button
            onClick={selectNone}
            className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
          >
            Clear
          </button>

          {labels.length > 0 && (
            <button
              onClick={() => window.print()}
              className="px-4 py-1.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
            >
              Print {labels.length} Label{labels.length !== 1 ? "s" : ""}
              {copies > 1 && (
                <span className="ml-1 opacity-75">
                  ({baseLabels.length} &times; {copies})
                </span>
              )}
            </button>
          )}
        </div>

        <div className="max-h-64 overflow-y-auto border rounded bg-white">
          {!items ? (
            <div className="p-4 text-sm text-gray-500">Loading...</div>
          ) : (items as Array<Record<string, unknown>>).length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No items found.</div>
          ) : (
            (items as Array<Record<string, unknown>>).map((item) => {
              const { mono, label } = getItemSubtext(item);
              return (
                <label
                  key={item._id as string}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item._id as string)}
                    onChange={() => toggleItem(item._id as string)}
                    className="w-4 h-4"
                  />
                  <span className="font-mono text-sm text-gray-500">{mono}</span>
                  <span className="text-sm font-medium text-gray-900">
                    {label}
                  </span>
                </label>
              );
            })
          )}
        </div>
      </div>

      {/* Label grid — printed */}
      <div className="p-4 flex flex-wrap gap-2 print:gap-0 print:p-0">
        {labels.map((label, i) => (
          <div
            key={i}
            className={`${labelClass} border border-gray-300 print:border-black rounded print:rounded-none flex items-center gap-3 px-3 print:break-inside-avoid`}
          >
            <QRCodeSVG
              value={label.qrValue}
              size={qrSize}
              level="M"
              marginSize={0}
            />
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="font-bold text-sm truncate text-gray-900">
                {label.line1}
              </div>
              <div className="text-xs text-gray-600 truncate">{label.line2}</div>
              {label.line3 && (
                <div className="text-xs text-gray-400 truncate">
                  {label.line3}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <style jsx global>{`
        @media print {
          @page {
            margin: 0.25in;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
    </div>
  );
}
