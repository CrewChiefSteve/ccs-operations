import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

// ============================================================
// PURCHASE ORDERS — Full PO Lifecycle
// ============================================================
// Dashboard contract: api.inventory.purchaseOrders.list / .create / .updateStatus
// ============================================================

// ============================================================
// CONTRACT: api.inventory.purchaseOrders.list
// Returns enriched POs with supplier name and line items.
// ============================================================
export const list = query({
  args: {
    search: v.optional(v.string()),     // Dashboard contract field
    status: v.optional(v.string()),
    supplierId: v.optional(v.id("suppliers")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let pos;
    if (args.status) {
      pos = await ctx.db
        .query("purchaseOrders")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(args.limit ?? 50);
    } else if (args.supplierId) {
      pos = await ctx.db
        .query("purchaseOrders")
        .withIndex("by_supplier", (q) => q.eq("supplierId", args.supplierId!))
        .order("desc")
        .take(args.limit ?? 50);
    } else {
      pos = await ctx.db.query("purchaseOrders").order("desc").take(args.limit ?? 50);
    }

    // Enrich with supplier name and line items
    const enriched = await Promise.all(
      pos.map(async (po) => {
        const supplier = await ctx.db.get(po.supplierId);
        const lines = await ctx.db
          .query("purchaseOrderLines")
          .withIndex("by_purchaseOrder", (q) => q.eq("purchaseOrderId", po._id))
          .collect();

        const enrichedLines = await Promise.all(
          lines.map(async (line) => {
            const component = await ctx.db.get(line.componentId);
            return {
              componentName: component?.name ?? "Unknown",
              quantity: line.quantityOrdered,
              unitCost: line.unitPrice,
              totalCost: line.lineTotal,
              quantityReceived: line.quantityReceived,
            };
          })
        );

        return {
          _id: po._id,
          poNumber: po.poNumber,
          supplierId: po.supplierId,
          supplierName: supplier?.name ?? "Unknown",
          status: po.status,
          orderDate: po.orderDate,
          expectedDelivery: po.expectedDelivery,
          actualDelivery: po.actualDelivery,
          trackingNumber: po.trackingNumber,
          subtotal: po.subtotal ?? 0,
          shipping: po.shippingCost,
          tax: po.taxAmount,
          total: po.totalCost ?? 0,
          notes: po.notes,
          createdBy: po.createdBy ?? "system",
          createdAt: po._creationTime,
          lineItems: enrichedLines.length > 0 ? enrichedLines : undefined,
        };
      })
    );

    // Client-side search filter
    if (args.search && args.search.trim().length > 0) {
      const term = args.search.toLowerCase();
      return enriched.filter(
        (po) =>
          po.poNumber.toLowerCase().includes(term) ||
          po.supplierName.toLowerCase().includes(term)
      );
    }

    return enriched;
  },
});

export const getById = query({
  args: { id: v.id("purchaseOrders") },
  handler: async (ctx, args) => {
    const po = await ctx.db.get(args.id);
    if (!po) return null;

    const supplier = await ctx.db.get(po.supplierId);
    const lines = await ctx.db
      .query("purchaseOrderLines")
      .withIndex("by_purchaseOrder", (q) => q.eq("purchaseOrderId", args.id))
      .collect();

    const enrichedLines = await Promise.all(
      lines.map(async (line) => {
        const component = await ctx.db.get(line.componentId);
        return {
          ...line,
          componentName: component?.name ?? "Unknown",
          partNumber: component?.partNumber ?? "Unknown",
        };
      })
    );

    return {
      ...po,
      supplierName: supplier?.name ?? "Unknown",
      supplierCode: supplier?.code ?? "Unknown",
      lines: enrichedLines,
    };
  },
});

export const getByPoNumber = query({
  args: { poNumber: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("purchaseOrders")
      .withIndex("by_poNumber", (q) => q.eq("poNumber", args.poNumber))
      .unique();
  },
});

async function nextPoNumber(ctx: any): Promise<string> {
  const year = new Date().getFullYear();
  const existing = await ctx.db
    .query("purchaseOrders")
    .order("desc")
    .take(1);

  let seq = 1;
  if (existing.length > 0) {
    const match = existing[0].poNumber.match(/PO-\d{4}-(\d+)/);
    if (match) seq = parseInt(match[1]) + 1;
  }

  return `PO-${year}-${String(seq).padStart(3, "0")}`;
}

export const create = mutation({
  args: {
    supplierId: v.id("suppliers"),
    poNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const supplier = await ctx.db.get(args.supplierId);
    if (!supplier) throw new Error("Supplier not found");

    const poNumber = args.poNumber ?? await nextPoNumber(ctx);

    const existing = await ctx.db
      .query("purchaseOrders")
      .withIndex("by_poNumber", (q) => q.eq("poNumber", poNumber))
      .unique();
    if (existing) throw new Error(`PO number ${poNumber} already exists`);

    return await ctx.db.insert("purchaseOrders", {
      poNumber,
      supplierId: args.supplierId,
      status: "draft",
      notes: args.notes,
      createdBy: args.createdBy,
      updatedAt: Date.now(),
    });
  },
});

export const addLine = mutation({
  args: {
    purchaseOrderId: v.id("purchaseOrders"),
    componentId: v.id("components"),
    quantityOrdered: v.number(),
    unitPrice: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const po = await ctx.db.get(args.purchaseOrderId);
    if (!po) throw new Error("Purchase order not found");
    if (po.status !== "draft") throw new Error("Can only add lines to draft POs");

    const lineTotal = args.quantityOrdered * args.unitPrice;

    const lineId = await ctx.db.insert("purchaseOrderLines", {
      purchaseOrderId: args.purchaseOrderId,
      componentId: args.componentId,
      quantityOrdered: args.quantityOrdered,
      quantityReceived: 0,
      unitPrice: args.unitPrice,
      lineTotal,
      status: "pending",
      notes: args.notes,
      updatedAt: Date.now(),
    });

    await recalculateTotals(ctx, args.purchaseOrderId);
    return lineId;
  },
});

async function recalculateTotals(ctx: any, poId: any) {
  const lines = await ctx.db
    .query("purchaseOrderLines")
    .withIndex("by_purchaseOrder", (q: any) => q.eq("purchaseOrderId", poId))
    .collect();

  const po = await ctx.db.get(poId);
  const subtotal = lines.reduce((sum: number, l: any) => sum + l.lineTotal, 0);
  const shipping = po?.shippingCost ?? 0;
  const tax = po?.taxAmount ?? 0;

  await ctx.db.patch(poId, {
    subtotal,
    totalCost: subtotal + shipping + tax,
    updatedAt: Date.now(),
  });
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "cancelled"],
  submitted: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["partial_received", "received"],
  partial_received: ["received"],
  received: [],
  cancelled: [],
};

// ============================================================
// CONTRACT: api.inventory.purchaseOrders.updateStatus
// Accepts both contract args (purchaseOrderId, status) and
// extended args (id, newStatus) for MCP/agent use.
// ============================================================
export const updateStatus = mutation({
  args: {
    // Contract args
    purchaseOrderId: v.optional(v.id("purchaseOrders")),
    status: v.optional(v.string()),
    // Extended args (MCP/agent)
    id: v.optional(v.id("purchaseOrders")),
    newStatus: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    trackingUrl: v.optional(v.string()),
    approvedBy: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const poId = args.purchaseOrderId ?? args.id;
    const targetStatus = args.status ?? args.newStatus;

    if (!poId) throw new Error("Must provide purchaseOrderId or id");
    if (!targetStatus) throw new Error("Must provide status or newStatus");

    const po = await ctx.db.get(poId);
    if (!po) throw new Error("Purchase order not found");

    const allowed = VALID_TRANSITIONS[po.status];
    if (!allowed || !allowed.includes(targetStatus)) {
      throw new Error(
        `Cannot transition PO from "${po.status}" to "${targetStatus}". Allowed: ${allowed?.join(", ")}`
      );
    }

    const updates: Record<string, unknown> = {
      status: targetStatus,
      updatedAt: Date.now(),
    };

    if (targetStatus === "submitted") updates.orderDate = Date.now();
    if (targetStatus === "received") updates.actualDelivery = Date.now();
    if (args.trackingNumber) updates.trackingNumber = args.trackingNumber;
    if (args.trackingUrl) updates.trackingUrl = args.trackingUrl;
    if (args.approvedBy) {
      updates.approvedBy = args.approvedBy;
      updates.approvedAt = Date.now();
    }
    if (args.notes) updates.notes = args.notes;

    await ctx.db.patch(poId, updates);
    return { id: poId, status: targetStatus };
  },
});

export const receiveLine = mutation({
  args: {
    lineId: v.id("purchaseOrderLines"),
    quantityReceived: v.number(),
    receivedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const line = await ctx.db.get(args.lineId);
    if (!line) throw new Error("PO line not found");

    const newReceived = line.quantityReceived + args.quantityReceived;
    if (newReceived > line.quantityOrdered) {
      throw new Error(
        `Cannot receive ${args.quantityReceived}. Already received ${line.quantityReceived} of ${line.quantityOrdered} ordered.`
      );
    }

    const lineStatus = newReceived >= line.quantityOrdered ? "received" : "partial";

    await ctx.db.patch(args.lineId, {
      quantityReceived: newReceived,
      status: lineStatus,
      updatedAt: Date.now(),
    });

    const po = await ctx.db.get(line.purchaseOrderId);
    if (po) {
      const allLines = await ctx.db
        .query("purchaseOrderLines")
        .withIndex("by_purchaseOrder", (q) => q.eq("purchaseOrderId", line.purchaseOrderId))
        .collect();

      const allReceived = allLines.every(
        (l) => l._id === args.lineId ? newReceived >= l.quantityOrdered : l.quantityReceived >= l.quantityOrdered
      );
      const anyReceived = allLines.some(
        (l) => l._id === args.lineId ? newReceived > 0 : l.quantityReceived > 0
      );

      if (allReceived && po.status !== "received") {
        await ctx.db.patch(line.purchaseOrderId, { status: "received", actualDelivery: Date.now(), updatedAt: Date.now() });
      } else if (anyReceived && po.status === "shipped") {
        await ctx.db.patch(line.purchaseOrderId, { status: "partial_received", updatedAt: Date.now() });
      }
    }

    return { lineId: args.lineId, quantityReceived: newReceived, status: lineStatus };
  },
});

// Enriched list for MCP/agent (backward compat)
export const listEnriched = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let pos;
    if (args.status) {
      pos = await ctx.db
        .query("purchaseOrders")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(args.limit ?? 50);
    } else {
      pos = await ctx.db.query("purchaseOrders").order("desc").take(args.limit ?? 50);
    }

    return await Promise.all(
      pos.map(async (po) => {
        const supplier = await ctx.db.get(po.supplierId);
        const lines = await ctx.db
          .query("purchaseOrderLines")
          .withIndex("by_purchaseOrder", (q) => q.eq("purchaseOrderId", po._id))
          .collect();

        return {
          ...po,
          supplierName: supplier?.name ?? "Unknown",
          supplierCode: supplier?.code ?? "Unknown",
          lineCount: lines.length,
          totalReceived: lines.reduce((sum, l) => sum + l.quantityReceived, 0),
          totalOrdered: lines.reduce((sum, l) => sum + l.quantityOrdered, 0),
        };
      })
    );
  },
});
