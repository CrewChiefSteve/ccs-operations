import { v } from "convex/values";
import { mutation, query } from "../_generated/server";

// ============================================================
// BUILD WORKFLOW — Material Lifecycle for Production
// ============================================================
// Orchestrates the inventory side of build orders:
//   planned → reserveMaterials → materials_reserved
//   materials_reserved → startBuild → in_progress (consumes stock)
//   in_progress → completeBuild → complete
//   any active state → cancelBuild → cancelled (releases reservations)
//
// Each step creates inventory transactions for full audit trail.
// ============================================================

// ----------------------------------------------------------
// QUERY: Build details with BOM + material availability
// ----------------------------------------------------------
export const getBuildDetails = query({
  args: {
    buildOrderId: v.optional(v.id("buildOrders")),
    id: v.optional(v.id("buildOrders")),
  },
  handler: async (ctx, args) => {
    const orderId = args.buildOrderId ?? args.id;
    if (!orderId) throw new Error("Must provide buildOrderId or id");

    const build = await ctx.db.get(orderId);
    if (!build) return null;

    // Get BOM entries for this product
    const bomEntries = await ctx.db
      .query("bomEntries")
      .withIndex("by_product", (q) => q.eq("productName", build.productName))
      .collect();

    // Enrich each BOM entry with component info + stock availability
    const materials = await Promise.all(
      bomEntries.map(async (entry) => {
        const component = await ctx.db.get(entry.componentId);

        // Get all inventory records for this component
        const inventoryRecords = await ctx.db
          .query("inventory")
          .withIndex("by_component", (q) => q.eq("componentId", entry.componentId))
          .collect();

        const totalQuantity = inventoryRecords.reduce((sum, r) => sum + r.quantity, 0);
        const totalAvailable = inventoryRecords.reduce((sum, r) => sum + r.availableQty, 0);
        const totalReserved = inventoryRecords.reduce((sum, r) => sum + r.reservedQty, 0);

        const required = entry.quantityPerUnit * build.quantity;
        const shortage = Math.max(0, required - totalAvailable);

        // Find preferred supplier for cost estimate
        const supplierLinks = await ctx.db
          .query("componentSuppliers")
          .withIndex("by_component", (q) => q.eq("componentId", entry.componentId))
          .collect();
        const preferred = supplierLinks.find((s) => s.isPreferred) ?? supplierLinks[0];
        let supplierName: string | undefined;
        let unitCost: number | undefined;
        if (preferred) {
          const supplier = await ctx.db.get(preferred.supplierId);
          supplierName = supplier?.name;
          unitCost = preferred.unitPrice ?? undefined;
        }

        // Stock locations breakdown
        const locations = await Promise.all(
          inventoryRecords.map(async (inv) => {
            const location = await ctx.db.get(inv.locationId);
            return {
              locationId: inv.locationId,
              inventoryId: inv._id,
              locationName: location?.name ?? "Unknown",
              locationCode: location?.code ?? "Unknown",
              quantity: inv.quantity,
              available: inv.availableQty,
              reserved: inv.reservedQty,
            };
          })
        );

        return {
          bomEntryId: entry._id,
          componentId: entry.componentId,
          componentName: component?.name ?? "Unknown",
          partNumber: component?.partNumber ?? "Unknown",
          category: component?.category,
          quantityPerUnit: entry.quantityPerUnit,
          totalRequired: required,
          totalQuantity,
          totalAvailable,
          totalReserved,
          shortage,
          sufficient: totalAvailable >= required,
          isOptional: entry.isOptional,
          referenceDesignator: entry.referenceDesignator,
          supplierName,
          unitCost,
          estimatedCost: unitCost ? unitCost * required : undefined,
          locations,
        };
      })
    );

    const requiredMaterials = materials.filter((m) => !m.isOptional);
    const allSufficient = requiredMaterials.every((m) => m.sufficient);
    const totalShortages = requiredMaterials.filter((m) => !m.sufficient).length;
    const estimatedMaterialCost = materials.reduce(
      (sum, m) => sum + (m.estimatedCost ?? 0),
      0
    );

    // Get transactions related to this build
    const transactions = await ctx.db
      .query("inventoryTransactions")
      .withIndex("by_reference", (q) =>
        q.eq("referenceType", "build_order").eq("referenceId", build.buildNumber)
      )
      .collect();

    return {
      ...build,
      materials,
      feasibility: {
        canBuild: allSufficient,
        totalComponents: materials.length,
        shortages: totalShortages,
        estimatedMaterialCost,
      },
      transactions: transactions.length,
    };
  },
});

// ----------------------------------------------------------
// MUTATION: Reserve materials (planned → materials_reserved)
// ----------------------------------------------------------
export const reserveMaterials = mutation({
  args: {
    buildOrderId: v.optional(v.id("buildOrders")),
    id: v.optional(v.id("buildOrders")),
    performedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const orderId = args.buildOrderId ?? args.id;
    if (!orderId) throw new Error("Must provide buildOrderId or id");

    const build = await ctx.db.get(orderId);
    if (!build) throw new Error("Build order not found");

    if (build.status !== "planned") {
      throw new Error(`Cannot reserve materials for build in "${build.status}" status. Must be "planned".`);
    }

    // Get BOM entries
    const bomEntries = await ctx.db
      .query("bomEntries")
      .withIndex("by_product", (q) => q.eq("productName", build.productName))
      .collect();

    if (bomEntries.length === 0) {
      throw new Error(`No BOM found for ${build.productName}. Cannot reserve materials.`);
    }

    const now = Date.now();
    const performedBy = args.performedBy ?? "dashboard";
    const reserved: Array<{ componentName: string; quantity: number; locationName: string }> = [];

    // First pass: verify all required materials are available
    for (const entry of bomEntries) {
      if (entry.isOptional) continue;

      const required = entry.quantityPerUnit * build.quantity;
      const inventoryRecords = await ctx.db
        .query("inventory")
        .withIndex("by_component", (q) => q.eq("componentId", entry.componentId))
        .collect();

      const totalAvailable = inventoryRecords.reduce((sum, r) => sum + r.availableQty, 0);

      if (totalAvailable < required) {
        const component = await ctx.db.get(entry.componentId);
        throw new Error(
          `Insufficient stock for ${component?.name ?? "unknown"}: need ${required}, only ${totalAvailable} available. ` +
          `Cannot reserve materials.`
        );
      }
    }

    // Second pass: actually reserve (FIFO across locations)
    for (const entry of bomEntries) {
      const required = entry.quantityPerUnit * build.quantity;
      if (required <= 0) continue;

      let remaining = required;

      // Get inventory sorted by available qty descending (reserve from largest first)
      const inventoryRecords = await ctx.db
        .query("inventory")
        .withIndex("by_component", (q) => q.eq("componentId", entry.componentId))
        .collect();

      const sorted = inventoryRecords
        .filter((r) => r.availableQty > 0)
        .sort((a, b) => b.availableQty - a.availableQty);

      for (const inv of sorted) {
        if (remaining <= 0) break;

        const reserveQty = Math.min(remaining, inv.availableQty);
        const newReserved = inv.reservedQty + reserveQty;
        const newAvailable = inv.quantity - newReserved;

        await ctx.db.patch(inv._id, {
          reservedQty: newReserved,
          availableQty: newAvailable,
          updatedAt: now,
        });

        // Audit trail
        await ctx.db.insert("inventoryTransactions", {
          type: "reserve",
          componentId: entry.componentId,
          locationId: inv.locationId,
          quantity: -reserveQty, // Negative: reduces available
          previousQty: inv.quantity,
          newQty: inv.quantity, // Qty unchanged; only reserved changes
          referenceType: "build_order",
          referenceId: build.buildNumber,
          performedBy,
          reason: `Reserved for ${build.buildNumber} (${build.productName} × ${build.quantity})`,
          timestamp: now,
        });

        const location = await ctx.db.get(inv.locationId);
        const component = await ctx.db.get(entry.componentId);
        reserved.push({
          componentName: component?.name ?? "Unknown",
          quantity: reserveQty,
          locationName: location?.name ?? "Unknown",
        });

        remaining -= reserveQty;
      }
    }

    // Transition build to materials_reserved
    await ctx.db.patch(orderId, {
      status: "materials_reserved",
      updatedAt: now,
    });

    return {
      buildOrderId: orderId,
      buildNumber: build.buildNumber,
      status: "materials_reserved",
      materialsReserved: reserved.length,
      details: reserved,
    };
  },
});

// ----------------------------------------------------------
// MUTATION: Start build (materials_reserved → in_progress)
// Consumes reserved stock — decrement quantity, clear reservation.
// ----------------------------------------------------------
export const startBuild = mutation({
  args: {
    buildOrderId: v.optional(v.id("buildOrders")),
    id: v.optional(v.id("buildOrders")),
    assignedTo: v.optional(v.string()),
    performedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const orderId = args.buildOrderId ?? args.id;
    if (!orderId) throw new Error("Must provide buildOrderId or id");

    const build = await ctx.db.get(orderId);
    if (!build) throw new Error("Build order not found");

    if (build.status !== "materials_reserved") {
      throw new Error(
        `Cannot start build in "${build.status}" status. Must be "materials_reserved".`
      );
    }

    const now = Date.now();
    const performedBy = args.performedBy ?? "dashboard";

    // Find all reserve transactions for this build to know what to consume
    const reservations = await ctx.db
      .query("inventoryTransactions")
      .withIndex("by_reference", (q) =>
        q.eq("referenceType", "build_order").eq("referenceId", build.buildNumber)
      )
      .collect();

    const reserveTxns = reservations.filter((t) => t.type === "reserve");

    // Consume each reservation
    for (const txn of reserveTxns) {
      const consumeQty = Math.abs(txn.quantity); // reserve txns are negative
      if (consumeQty <= 0) continue;

      const inv = await ctx.db
        .query("inventory")
        .withIndex("by_component_location", (q) =>
          q.eq("componentId", txn.componentId).eq("locationId", txn.locationId)
        )
        .unique();

      if (!inv) continue;

      const newQty = inv.quantity - consumeQty;
      const newReserved = Math.max(0, inv.reservedQty - consumeQty);
      const newAvailable = newQty - newReserved;

      const status = computeStatus(newQty, inv.minimumStock ?? undefined, inv.maximumStock ?? undefined);

      await ctx.db.patch(inv._id, {
        quantity: newQty,
        reservedQty: newReserved,
        availableQty: newAvailable,
        status,
        updatedAt: now,
      });

      // Audit trail
      await ctx.db.insert("inventoryTransactions", {
        type: "consume",
        componentId: txn.componentId,
        locationId: txn.locationId,
        quantity: -consumeQty,
        previousQty: inv.quantity,
        newQty,
        referenceType: "build_order",
        referenceId: build.buildNumber,
        performedBy,
        reason: `Consumed for ${build.buildNumber} (${build.productName} × ${build.quantity})`,
        timestamp: now,
      });
    }

    // Transition build to in_progress
    await ctx.db.patch(orderId, {
      status: "in_progress",
      actualStart: now,
      assignedTo: args.assignedTo ?? build.assignedTo,
      updatedAt: now,
    });

    return {
      buildOrderId: orderId,
      buildNumber: build.buildNumber,
      status: "in_progress",
      materialsConsumed: reserveTxns.length,
    };
  },
});

// ----------------------------------------------------------
// MUTATION: Complete build (qc → complete)
// ----------------------------------------------------------
export const completeBuild = mutation({
  args: {
    buildOrderId: v.optional(v.id("buildOrders")),
    id: v.optional(v.id("buildOrders")),
    qcStatus: v.optional(v.string()),
    qcNotes: v.optional(v.string()),
    performedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const orderId = args.buildOrderId ?? args.id;
    if (!orderId) throw new Error("Must provide buildOrderId or id");

    const build = await ctx.db.get(orderId);
    if (!build) throw new Error("Build order not found");

    if (build.status !== "qc") {
      throw new Error(`Cannot complete build in "${build.status}" status. Must be "qc".`);
    }

    const now = Date.now();

    await ctx.db.patch(orderId, {
      status: "complete",
      completedAt: now,
      qcStatus: args.qcStatus ?? "passed",
      qcNotes: args.qcNotes,
      updatedAt: now,
    });

    return {
      buildOrderId: orderId,
      buildNumber: build.buildNumber,
      status: "complete",
      completedAt: now,
    };
  },
});

// ----------------------------------------------------------
// MUTATION: Cancel build (any active → cancelled)
// Releases any existing material reservations.
// ----------------------------------------------------------
export const cancelBuild = mutation({
  args: {
    buildOrderId: v.optional(v.id("buildOrders")),
    id: v.optional(v.id("buildOrders")),
    reason: v.optional(v.string()),
    performedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const orderId = args.buildOrderId ?? args.id;
    if (!orderId) throw new Error("Must provide buildOrderId or id");

    const build = await ctx.db.get(orderId);
    if (!build) throw new Error("Build order not found");

    if (["complete", "cancelled"].includes(build.status)) {
      throw new Error(`Cannot cancel build in "${build.status}" status.`);
    }

    const now = Date.now();
    const performedBy = args.performedBy ?? "dashboard";

    // If materials were reserved but not yet consumed, release them
    if (build.status === "materials_reserved") {
      const reservations = await ctx.db
        .query("inventoryTransactions")
        .withIndex("by_reference", (q) =>
          q.eq("referenceType", "build_order").eq("referenceId", build.buildNumber)
        )
        .collect();

      const reserveTxns = reservations.filter((t) => t.type === "reserve");

      for (const txn of reserveTxns) {
        const releaseQty = Math.abs(txn.quantity);
        if (releaseQty <= 0) continue;

        const inv = await ctx.db
          .query("inventory")
          .withIndex("by_component_location", (q) =>
            q.eq("componentId", txn.componentId).eq("locationId", txn.locationId)
          )
          .unique();

        if (!inv) continue;

        const newReserved = Math.max(0, inv.reservedQty - releaseQty);
        const newAvailable = inv.quantity - newReserved;

        await ctx.db.patch(inv._id, {
          reservedQty: newReserved,
          availableQty: newAvailable,
          updatedAt: now,
        });

        // Audit trail
        await ctx.db.insert("inventoryTransactions", {
          type: "unreserve",
          componentId: txn.componentId,
          locationId: txn.locationId,
          quantity: releaseQty, // Positive: restores available
          previousQty: inv.quantity,
          newQty: inv.quantity,
          referenceType: "build_order",
          referenceId: build.buildNumber,
          performedBy,
          reason: `Released — ${build.buildNumber} cancelled` +
            (args.reason ? `: ${args.reason}` : ""),
          timestamp: now,
        });
      }
    }

    await ctx.db.patch(orderId, {
      status: "cancelled",
      notes: (build.notes ? build.notes + "\n" : "") +
        `[Cancelled ${new Date(now).toISOString()}] ${args.reason ?? "No reason given"}`,
      updatedAt: now,
    });

    return {
      buildOrderId: orderId,
      buildNumber: build.buildNumber,
      status: "cancelled",
    };
  },
});

// ----------------------------------------------------------
// Helper
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
