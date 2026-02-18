import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

// ============================================================
// RECEIVING — Full PO Receiving Workflow
// ============================================================
// The closed loop: PO arrives → receive through dashboard →
//   stock updates → transactions logged → alerts auto-resolve.
//
// receiveShipment: Orchestrates the full receiving flow for a PO.
// getReceivable: Returns POs that are ready to receive (shipped/confirmed/partial).
// getReceivingDetails: Returns PO with lines and their receiving status.
// ============================================================

// ----------------------------------------------------------
// QUERY: Which POs are ready to receive?
// ----------------------------------------------------------
export const getReceivable = query({
  handler: async (ctx) => {
    const pos = await ctx.db.query("purchaseOrders").collect();
    const receivable = pos.filter((po) =>
      ["shipped", "confirmed", "partial_received"].includes(po.status)
    );

    return await Promise.all(
      receivable.map(async (po) => {
        const supplier = await ctx.db.get(po.supplierId);
        const lines = await ctx.db
          .query("purchaseOrderLines")
          .withIndex("by_purchaseOrder", (q) => q.eq("purchaseOrderId", po._id))
          .collect();

        const enrichedLines = await Promise.all(
          lines.map(async (line) => {
            const component = await ctx.db.get(line.componentId);
            return {
              _id: line._id,
              componentId: line.componentId,
              componentName: component?.name ?? "Unknown",
              partNumber: component?.partNumber ?? "Unknown",
              quantityOrdered: line.quantityOrdered,
              quantityReceived: line.quantityReceived,
              remaining: line.quantityOrdered - line.quantityReceived,
              unitPrice: line.unitPrice,
              status: line.status,
            };
          })
        );

        return {
          _id: po._id,
          poNumber: po.poNumber,
          supplierName: supplier?.name ?? "Unknown",
          status: po.status,
          expectedDelivery: po.expectedDelivery,
          trackingNumber: po.trackingNumber,
          totalCost: po.totalCost ?? 0,
          lines: enrichedLines,
          totalOrdered: lines.reduce((s, l) => s + l.quantityOrdered, 0),
          totalReceived: lines.reduce((s, l) => s + l.quantityReceived, 0),
        };
      })
    );
  },
});

// ----------------------------------------------------------
// QUERY: Full receiving details for a specific PO
// ----------------------------------------------------------
export const getReceivingDetails = query({
  args: {
    purchaseOrderId: v.optional(v.id("purchaseOrders")),
    id: v.optional(v.id("purchaseOrders")),
  },
  handler: async (ctx, args) => {
    const poId = args.purchaseOrderId ?? args.id;
    if (!poId) throw new Error("Must provide purchaseOrderId or id");

    const po = await ctx.db.get(poId);
    if (!po) return null;

    const supplier = await ctx.db.get(po.supplierId);
    const lines = await ctx.db
      .query("purchaseOrderLines")
      .withIndex("by_purchaseOrder", (q) => q.eq("purchaseOrderId", poId))
      .collect();

    const enrichedLines = await Promise.all(
      lines.map(async (line) => {
        const component = await ctx.db.get(line.componentId);

        // Find existing inventory records for this component to suggest locations
        const inventoryRecords = await ctx.db
          .query("inventory")
          .withIndex("by_component", (q) => q.eq("componentId", line.componentId))
          .collect();

        const existingLocations = await Promise.all(
          inventoryRecords.map(async (inv) => {
            const location = await ctx.db.get(inv.locationId);
            return {
              locationId: inv.locationId,
              locationName: location?.name ?? "Unknown",
              locationCode: location?.code ?? "Unknown",
              currentQty: inv.quantity,
            };
          })
        );

        return {
          _id: line._id,
          componentId: line.componentId,
          componentName: component?.name ?? "Unknown",
          partNumber: component?.partNumber ?? "Unknown",
          quantityOrdered: line.quantityOrdered,
          quantityReceived: line.quantityReceived,
          remaining: line.quantityOrdered - line.quantityReceived,
          unitPrice: line.unitPrice,
          lineTotal: line.lineTotal,
          status: line.status,
          existingLocations,
        };
      })
    );

    return {
      _id: po._id,
      poNumber: po.poNumber,
      supplierId: po.supplierId,
      supplierName: supplier?.name ?? "Unknown",
      status: po.status,
      expectedDelivery: po.expectedDelivery,
      trackingNumber: po.trackingNumber,
      totalCost: po.totalCost ?? 0,
      notes: po.notes,
      lines: enrichedLines,
    };
  },
});

// ----------------------------------------------------------
// MUTATION: Receive a full shipment (the main workflow)
// ----------------------------------------------------------
// Takes an array of line receipts so the user can receive the
// entire PO in one action from the dashboard.
// ----------------------------------------------------------
export const receiveShipment = mutation({
  args: {
    purchaseOrderId: v.optional(v.id("purchaseOrders")),
    id: v.optional(v.id("purchaseOrders")),
    lineReceipts: v.array(
      v.object({
        lineId: v.id("purchaseOrderLines"),
        quantityReceived: v.number(),
        locationId: v.id("locations"),
      })
    ),
    receivedBy: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const poId = args.purchaseOrderId ?? args.id;
    if (!poId) throw new Error("Must provide purchaseOrderId or id");

    const po = await ctx.db.get(poId);
    if (!po) throw new Error("Purchase order not found");

    if (!["shipped", "confirmed", "partial_received"].includes(po.status)) {
      throw new Error(
        `Cannot receive PO in "${po.status}" status. Must be shipped, confirmed, or partial_received.`
      );
    }

    if (args.lineReceipts.length === 0) {
      throw new Error("Must provide at least one line receipt");
    }

    const now = Date.now();
    const receivedBy = args.receivedBy ?? "dashboard";
    const results: Array<{
      lineId: string;
      componentName: string;
      quantityReceived: number;
      newStockLevel: number;
      locationName: string;
    }> = [];

    // --- Process each line receipt ---
    for (const receipt of args.lineReceipts) {
      if (receipt.quantityReceived <= 0) continue;

      // 1. Validate the PO line
      const line = await ctx.db.get(receipt.lineId);
      if (!line) throw new Error(`PO line ${receipt.lineId} not found`);
      if (line.purchaseOrderId !== poId) {
        throw new Error(`Line ${receipt.lineId} does not belong to this PO`);
      }

      const newLineReceived = line.quantityReceived + receipt.quantityReceived;
      if (newLineReceived > line.quantityOrdered) {
        throw new Error(
          `Cannot receive ${receipt.quantityReceived} for line ${receipt.lineId}. ` +
          `Already received ${line.quantityReceived} of ${line.quantityOrdered}.`
        );
      }

      // 2. Validate the location
      const location = await ctx.db.get(receipt.locationId);
      if (!location) throw new Error(`Location ${receipt.locationId} not found`);

      const component = await ctx.db.get(line.componentId);
      if (!component) throw new Error(`Component ${line.componentId} not found`);

      // 3. Update PO line
      const lineStatus = newLineReceived >= line.quantityOrdered ? "received" : "partial";
      await ctx.db.patch(receipt.lineId, {
        quantityReceived: newLineReceived,
        status: lineStatus,
        updatedAt: now,
      });

      // 4. Update or create inventory record
      const existingInventory = await ctx.db
        .query("inventory")
        .withIndex("by_component_location", (q) =>
          q.eq("componentId", line.componentId).eq("locationId", receipt.locationId)
        )
        .unique();

      let previousQty: number;
      let newQty: number;

      if (existingInventory) {
        previousQty = existingInventory.quantity;
        newQty = previousQty + receipt.quantityReceived;

        const newAvailable = newQty - existingInventory.reservedQty;
        const status = computeStatus(
          newQty,
          existingInventory.minimumStock ?? undefined,
          existingInventory.maximumStock ?? undefined
        );

        await ctx.db.patch(existingInventory._id, {
          quantity: newQty,
          availableQty: newAvailable,
          costPerUnit: line.unitPrice, // Update cost to latest PO price
          status,
          updatedAt: now,
        });
      } else {
        // Create new inventory record for this component at this location
        previousQty = 0;
        newQty = receipt.quantityReceived;

        await ctx.db.insert("inventory", {
          componentId: line.componentId,
          locationId: receipt.locationId,
          quantity: newQty,
          reservedQty: 0,
          availableQty: newQty,
          costPerUnit: line.unitPrice,
          status: newQty > 0 ? "in_stock" : "out_of_stock",
          updatedAt: now,
        });
      }

      // 5. Create inventory transaction (audit trail)
      await ctx.db.insert("inventoryTransactions", {
        type: "receive",
        componentId: line.componentId,
        locationId: receipt.locationId,
        quantity: receipt.quantityReceived,
        previousQty,
        newQty,
        referenceType: "purchase_order",
        referenceId: po.poNumber,
        performedBy: receivedBy,
        reason: `Received from ${po.poNumber}`,
        notes: args.notes,
        timestamp: now,
      });

      // 6. Auto-resolve low_stock/out_of_stock alerts for this component
      //    (only if stock is now above minimum)
      const allInventoryForComponent = await ctx.db
        .query("inventory")
        .withIndex("by_component", (q) => q.eq("componentId", line.componentId))
        .collect();

      const totalQty = allInventoryForComponent.reduce((sum, r) => sum + r.quantity, 0);
      // Use the minimumStock from the record we just updated, or any record that has it
      const minStock = allInventoryForComponent.find(
        (r) => r.minimumStock !== undefined && r.minimumStock !== null
      )?.minimumStock;

      if (minStock !== undefined && totalQty > minStock) {
        const activeAlerts = await ctx.db
          .query("alerts")
          .withIndex("by_component", (q) => q.eq("componentId", line.componentId))
          .collect();

        for (const alert of activeAlerts) {
          if (
            (alert.type === "low_stock" || alert.type === "out_of_stock") &&
            (alert.status === "active" || alert.status === "acknowledged")
          ) {
            await ctx.db.patch(alert._id, {
              status: "resolved",
              resolvedBy: "receiving_workflow",
              resolvedAt: now,
              resolvedAction: `Stock replenished to ${totalQty} via ${po.poNumber} (min: ${minStock})`,
              updatedAt: now,
            });
          }
        }
      }

      // 7. Also resolve any po_arrival alerts for this PO
      const poAlerts = await ctx.db
        .query("alerts")
        .withIndex("by_type", (q) => q.eq("type", "po_overdue"))
        .collect();

      for (const alert of poAlerts) {
        if (
          alert.purchaseOrderId === poId &&
          (alert.status === "active" || alert.status === "acknowledged")
        ) {
          await ctx.db.patch(alert._id, {
            status: "resolved",
            resolvedBy: "receiving_workflow",
            resolvedAt: now,
            resolvedAction: `PO received via receiving workflow`,
            updatedAt: now,
          });
        }
      }

      results.push({
        lineId: receipt.lineId as string,
        componentName: component.name,
        quantityReceived: receipt.quantityReceived,
        newStockLevel: newQty,
        locationName: location.name,
      });
    }

    // --- Update PO status based on all lines ---
    const allLines = await ctx.db
      .query("purchaseOrderLines")
      .withIndex("by_purchaseOrder", (q) => q.eq("purchaseOrderId", poId))
      .collect();

    const allFullyReceived = allLines.every(
      (l) => l.quantityReceived >= l.quantityOrdered
    );
    const anyReceived = allLines.some((l) => l.quantityReceived > 0);

    let newPoStatus = po.status;
    if (allFullyReceived) {
      newPoStatus = "received";
    } else if (anyReceived) {
      newPoStatus = "partial_received";
    }

    const poUpdates: Record<string, unknown> = {
      status: newPoStatus,
      updatedAt: now,
    };
    if (allFullyReceived) {
      poUpdates.actualDelivery = now;
    }
    if (args.notes) {
      poUpdates.notes = (po.notes ? po.notes + "\n" : "") +
        `[${new Date(now).toISOString()}] Received by ${receivedBy}: ${args.notes}`;
    }

    await ctx.db.patch(poId, poUpdates);

    return {
      purchaseOrderId: poId,
      poNumber: po.poNumber,
      newStatus: newPoStatus,
      linesReceived: results.length,
      results,
    };
  },
});

// ----------------------------------------------------------
// Helper: compute inventory status from quantity + thresholds
// (duplicated from stock.ts to avoid cross-file import issues
//  in Convex — each file must be self-contained)
// ----------------------------------------------------------
function computeStatus(
  quantity: number,
  minimumStock?: number,
  maximumStock?: number
): string {
  if (quantity <= 0) return "out_of_stock";
  if (minimumStock && quantity <= minimumStock) return "low_stock";
  if (maximumStock && quantity > maximumStock) return "overstock";
  return "in_stock";
}