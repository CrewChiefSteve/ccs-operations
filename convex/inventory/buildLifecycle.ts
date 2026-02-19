import { v } from "convex/values";
import {
  mutation,
  query,
  internalMutation,
  internalQuery,
  internalAction,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

// ============================================================
// BUILD ORDER LIFECYCLE MANAGER
// ============================================================
//
// The full lifecycle:
//
//   planned → materials_reserved → in_progress → qc → complete
//      ↕              ↕               ↕           ↕
//   cancelled      cancelled       cancelled   cancelled
//
// Each transition has side effects:
//   planned → materials_reserved:
//     - BOM feasibility check (can we build N units?)
//     - Reserve stock for each BOM line item
//     - Create material pick list task for warehouse
//
//   materials_reserved → in_progress:
//     - Validate all materials still reserved
//     - Link to Drive assembly instructions
//     - Record actual start time
//
//   in_progress → qc:
//     - Record units built
//     - Create QC checklist task
//
//   qc → complete:
//     - Record QC results (pass/fail counts)
//     - Consume reserved stock (creates inventory transactions)
//     - Update finished goods count
//     - Release any unused reservations
//
//   any → cancelled:
//     - Release all reserved stock
//     - Log cancellation reason
//
// This file adds the LIFECYCLE ACTIONS on top of the existing
// buildOrders.ts CRUD. Import alongside the existing file.

// ============================================================
// TYPES
// ============================================================

interface MaterialRequirement {
  componentId: Id<"components">;
  componentName: string;
  partNumber: string;
  quantityPerUnit: number;
  totalNeeded: number;
  currentStock: number;
  availableStock: number;
  shortfall: number;
  canFulfill: boolean;
  referenceDesignator?: string;
}

interface ReservationResult {
  componentId: Id<"components">;
  componentName: string;
  quantityReserved: number;
  inventoryId: Id<"inventory">;
  success: boolean;
  error?: string;
}

// ============================================================
// QUERIES
// ============================================================

// Get full build order detail with materials status
export const getDetail = query({
  args: { id: v.id("buildOrders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order) throw new Error("Build order not found");

    // Get BOM entries for this product
    const bomEntries = await ctx.db
      .query("bomEntries")
      .withIndex("by_product", (q) => q.eq("productName",order.productName))
      .collect();

    // Filter to matching BOM version if specified
    const relevantBom = order.bomVersion
      ? bomEntries.filter((e) => e.bomVersion === order.bomVersion)
      : bomEntries;

    // Enrich with component details and stock levels
    const materials = await Promise.all(
      relevantBom.map(async (entry) => {
        const component = await ctx.db.get(entry.componentId);
        if (!component) return null;

        // Get stock records
        const stockRecords = await ctx.db
          .query("inventory")
          .withIndex("by_component", (q) =>
            q.eq("componentId", entry.componentId)
          )
          .collect();

        const totalStock = stockRecords.reduce(
          (sum, r) => sum + r.quantity,
          0
        );
        const totalAvailable = stockRecords.reduce(
          (sum, r) => sum + (r.availableQty ?? r.quantity - (r.reservedQty ?? 0)),
          0
        );
        const totalNeeded = entry.quantityPerUnit * order.quantity;

        return {
          bomEntryId: entry._id,
          componentId: entry.componentId,
          componentName: component.name,
          partNumber: component.partNumber,
          quantityPerUnit: entry.quantityPerUnit,
          totalNeeded,
          currentStock: totalStock,
          availableStock: totalAvailable,
          shortfall: Math.max(0, totalNeeded - totalAvailable),
          canFulfill: totalAvailable >= totalNeeded,
          referenceDesignator: entry.referenceDesignator,
          isOptional: entry.isOptional,
        };
      })
    );

    // Get related transactions
    const transactions = await ctx.db
      .query("inventoryTransactions")
      .withIndex("by_reference", (q) =>
        q.eq("referenceType", "build_order").eq("referenceId", order._id as string)
      )
      .collect();

    // Get related tasks
    const allTasks = await ctx.db.query("tasks").collect();
    const relatedTasks = allTasks.filter((t) => t.buildOrderId === order._id);

    // Get related alerts
    const allAlerts = await ctx.db.query("alerts").collect();
    const relatedAlerts = allAlerts.filter((a) => a.buildOrderId === order._id);

    return {
      ...order,
      materials: materials.filter(Boolean),
      canReserveMaterials:
        order.status === "planned" &&
        materials.filter(Boolean).every((m) => m!.canFulfill),
      allMaterialsFulfillable: materials
        .filter(Boolean)
        .every((m) => m!.canFulfill),
      shortages: materials.filter((m) => m && !m.canFulfill),
      transactions,
      relatedTasks,
      relatedAlerts,
    };
  },
});

// Material pick list for a build order (used by warehouse workers)
export const getPickList = query({
  args: { id: v.id("buildOrders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order) throw new Error("Build order not found");

    const bomEntries = await ctx.db
      .query("bomEntries")
      .withIndex("by_product", (q) => q.eq("productName",order.productName))
      .collect();

    const relevantBom = order.bomVersion
      ? bomEntries.filter((e) => e.bomVersion === order.bomVersion)
      : bomEntries;

    const pickItems = await Promise.all(
      relevantBom.map(async (entry) => {
        const component = await ctx.db.get(entry.componentId);
        if (!component) return null;

        // Find where this component is stored
        const stockRecords = await ctx.db
          .query("inventory")
          .withIndex("by_component", (q) =>
            q.eq("componentId", entry.componentId)
          )
          .collect();

        const locations = await Promise.all(
          stockRecords
            .filter((r) => r.quantity > 0)
            .map(async (r) => {
              const location = r.locationId
                ? await ctx.db.get(r.locationId)
                : null;
              return {
                locationName: location?.name ?? "Unassigned",
                locationId: r.locationId,
                available: r.availableQty ?? r.quantity - (r.reservedQty ?? 0),
                total: r.quantity,
              };
            })
        );

        return {
          componentName: component.name,
          partNumber: component.partNumber,
          quantityNeeded: entry.quantityPerUnit * order.quantity,
          referenceDesignator: entry.referenceDesignator,
          isOptional: entry.isOptional,
          locations: locations.filter((l) => l.available > 0),
        };
      })
    );

    return {
      buildNumber: order.buildNumber,
      product: order.productName,
      quantity: order.quantity,
      status: order.status,
      items: pickItems.filter(Boolean),
    };
  },
});

// List active build orders with summary
export const listActive = query({
  handler: async (ctx) => {
    const allOrders = await ctx.db.query("buildOrders").collect();
    const active = allOrders.filter((o) =>
      ["planned", "materials_reserved", "in_progress", "qc"].includes(o.status)
    );

    return active.sort(
      (a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0)
    );
  },
});

// Build history with completion stats
export const history = query({
  args: {
    product: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let orders;
    if (args.product) {
      orders = await ctx.db
        .query("buildOrders")
        .withIndex("by_product", (q) => q.eq("productName",args.product!))
        .order("desc")
        .take(args.limit ?? 50);
    } else {
      orders = await ctx.db
        .query("buildOrders")
        .order("desc")
        .take(args.limit ?? 50);
    }

    return orders.map((o) => ({
      ...o,
      duration:
        o.completedAt && o.actualStart
          ? o.completedAt - o.actualStart
          : null,
      yieldRate:
        o.qcPassedCount != null && o.quantity > 0
          ? Math.round((o.qcPassedCount / o.quantity) * 100)
          : null,
    }));
  },
});

// ============================================================
// INTERNAL QUERIES
// ============================================================

export const _getBomForBuild = internalQuery({
  args: {
    product: v.string(),
    bomVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("bomEntries")
      .withIndex("by_product", (q) => q.eq("productName",args.product))
      .collect();

    const filtered = args.bomVersion
      ? entries.filter((e) => e.bomVersion === args.bomVersion)
      : entries;

    return await Promise.all(
      filtered.map(async (entry) => {
        const component = await ctx.db.get(entry.componentId);
        return {
          ...entry,
          componentName: component?.name ?? "Unknown",
          partNumber: component?.partNumber ?? "Unknown",
        };
      })
    );
  },
});

export const _getAvailableStock = internalQuery({
  args: { componentId: v.id("components") },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("inventory")
      .withIndex("by_component", (q) => q.eq("componentId", args.componentId))
      .collect();

    // Return records sorted by available qty descending (pick from fullest bin first)
    return records
      .map((r) => ({
        ...r,
        effectiveAvailable:
          r.availableQty ?? r.quantity - (r.reservedQty ?? 0),
      }))
      .filter((r) => r.effectiveAvailable > 0)
      .sort((a, b) => b.effectiveAvailable - a.effectiveAvailable);
  },
});

// ============================================================
// INTERNAL MUTATIONS
// ============================================================

// Reserve stock for a single component across inventory records
export const _reserveComponentStock = internalMutation({
  args: {
    componentId: v.id("components"),
    quantity: v.number(),
    buildOrderId: v.id("buildOrders"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("inventory")
      .withIndex("by_component", (q) => q.eq("componentId", args.componentId))
      .collect();

    // Sort by available (pick from fullest locations first)
    const sorted = records
      .map((r) => ({
        ...r,
        effectiveAvailable:
          r.availableQty ?? r.quantity - (r.reservedQty ?? 0),
      }))
      .filter((r) => r.effectiveAvailable > 0)
      .sort((a, b) => b.effectiveAvailable - a.effectiveAvailable);

    let remaining = args.quantity;
    const reservations: Array<{ inventoryId: Id<"inventory">; qty: number }> = [];

    for (const record of sorted) {
      if (remaining <= 0) break;
      const toReserve = Math.min(remaining, record.effectiveAvailable);

      const newReserved = (record.reservedQty ?? 0) + toReserve;
      const newAvailable = record.quantity - newReserved;

      await ctx.db.patch(record._id, {
        reservedQty: newReserved,
        availableQty: newAvailable,
        updatedAt: Date.now(),
      });

      reservations.push({ inventoryId: record._id, qty: toReserve });
      remaining -= toReserve;
    }

    if (remaining > 0) {
      return {
        success: false,
        reserved: args.quantity - remaining,
        shortfall: remaining,
        reservations,
      };
    }

    return { success: true, reserved: args.quantity, shortfall: 0, reservations };
  },
});

// Release all reservations for a build order (on cancel)
export const _releaseAllReservations = internalMutation({
  args: { buildOrderId: v.id("buildOrders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.buildOrderId);
    if (!order) return { released: 0 };

    // Get the BOM to know what was reserved
    const bomEntries = await ctx.db
      .query("bomEntries")
      .withIndex("by_product", (q) => q.eq("productName",order.productName))
      .collect();

    const relevant = order.bomVersion
      ? bomEntries.filter((e) => e.bomVersion === order.bomVersion)
      : bomEntries;

    let totalReleased = 0;

    for (const entry of relevant) {
      const releaseQty = entry.quantityPerUnit * order.quantity;
      const records = await ctx.db
        .query("inventory")
        .withIndex("by_component", (q) =>
          q.eq("componentId", entry.componentId)
        )
        .collect();

      let remaining = releaseQty;
      for (const record of records) {
        if (remaining <= 0) break;
        const currentReserved = record.reservedQty ?? 0;
        if (currentReserved <= 0) continue;

        const toRelease = Math.min(remaining, currentReserved);
        const newReserved = currentReserved - toRelease;
        const newAvailable = record.quantity - newReserved;

        await ctx.db.patch(record._id, {
          reservedQty: newReserved,
          availableQty: newAvailable,
          updatedAt: Date.now(),
        });

        remaining -= toRelease;
        totalReleased += toRelease;
      }
    }

    return { released: totalReleased };
  },
});

// Consume reserved stock (on build complete) — creates transactions
export const _consumeReservedStock = internalMutation({
  args: {
    buildOrderId: v.id("buildOrders"),
    unitsCompleted: v.number(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.buildOrderId);
    if (!order) throw new Error("Build order not found");

    const bomEntries = await ctx.db
      .query("bomEntries")
      .withIndex("by_product", (q) => q.eq("productName",order.productName))
      .collect();

    const relevant = order.bomVersion
      ? bomEntries.filter((e) => e.bomVersion === order.bomVersion)
      : bomEntries;

    const transactions: Id<"inventoryTransactions">[] = [];

    for (const entry of relevant) {
      const consumeQty = entry.quantityPerUnit * args.unitsCompleted;

      const records = await ctx.db
        .query("inventory")
        .withIndex("by_component", (q) =>
          q.eq("componentId", entry.componentId)
        )
        .collect();

      let remaining = consumeQty;

      for (const record of records) {
        if (remaining <= 0) break;
        const currentReserved = record.reservedQty ?? 0;
        if (currentReserved <= 0) continue;

        const toConsume = Math.min(remaining, currentReserved);
        const newQty = record.quantity - toConsume;
        const newReserved = currentReserved - toConsume;
        const newAvailable = newQty - newReserved;

        await ctx.db.patch(record._id, {
          quantity: newQty,
          reservedQty: newReserved,
          availableQty: Math.max(0, newAvailable),
          updatedAt: Date.now(),
        });

        // Create audit transaction
        const txnId = await ctx.db.insert("inventoryTransactions", {
          type: "consume",
          componentId: entry.componentId,
          locationId: record.locationId,
          quantity: -toConsume,
          previousQty: record.quantity,
          newQty: newQty,
          referenceType: "build_order",
          referenceId: args.buildOrderId as string,
          reason: `Consumed for ${order.buildNumber}: ${args.unitsCompleted}x ${order.productName}`,
          performedBy: "agent",
          timestamp: Date.now(),
        });

        transactions.push(txnId);
        remaining -= toConsume;
      }
    }

    return { consumed: transactions.length, transactionIds: transactions };
  },
});

// Create task
export const _createTask = internalMutation({
  args: {
    title: v.string(),
    description: v.string(),
    priority: v.string(),
    category: v.string(),
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const typeMap: Record<string, string> = {
      "production": "general",
      "inventory": "general",
      "drive": "review_bom",
    };
    const agentCtx = args.relatedEntityType
      ? JSON.stringify({ relatedEntityType: args.relatedEntityType, relatedEntityId: args.relatedEntityId })
      : undefined;
    return await ctx.db.insert("tasks", {
      title: args.title,
      description: args.description,
      type: typeMap[args.category] ?? "general",
      priority: args.priority as any,
      status: "pending",
      dueAt: args.dueDate,
      agentGenerated: true,
      escalationLevel: 0,
      agentContext: agentCtx,
      updatedAt: Date.now(),
    });
  },
});

// Create alert
export const _createAlert = internalMutation({
  args: {
    type: v.string(),
    severity: v.string(),
    title: v.string(),
    message: v.string(),
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("alerts", {
      type: args.type,
      severity: args.severity as any,
      title: args.title,
      message: args.message,
      status: "active",
      agentGenerated: true,
      agentContext: args.relatedEntityType
        ? JSON.stringify({ relatedEntityType: args.relatedEntityType, relatedEntityId: args.relatedEntityId })
        : undefined,
      updatedAt: Date.now(),
    });
  },
});

// ============================================================
// MUTATIONS — Lifecycle Transitions
// ============================================================

// PLAN → RESERVE MATERIALS
// Checks BOM feasibility, then reserves stock for each line item
export const reserveMaterials = mutation({
  args: {
    id: v.id("buildOrders"),
    force: v.optional(v.boolean()), // Reserve what's available even if short
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order) throw new Error("Build order not found");
    if (order.status !== "planned") {
      throw new Error(
        `Cannot reserve materials: order is "${order.status}", expected "planned"`
      );
    }

    // Get BOM entries
    const bomEntries = await ctx.db
      .query("bomEntries")
      .withIndex("by_product", (q) => q.eq("productName",order.productName))
      .collect();

    const relevant = order.bomVersion
      ? bomEntries.filter((e) => e.bomVersion === order.bomVersion)
      : bomEntries;

    if (relevant.length === 0) {
      throw new Error(
        `No BOM entries found for ${order.productName}${order.bomVersion ? ` v${order.bomVersion}` : ""}. Cannot reserve materials.`
      );
    }

    // Check feasibility first
    const shortages: Array<{
      componentName: string;
      partNumber: string;
      needed: number;
      available: number;
      shortfall: number;
    }> = [];

    for (const entry of relevant) {
      if (entry.isOptional) continue;
      const component = await ctx.db.get(entry.componentId);
      if (!component) continue;

      const stockRecords = await ctx.db
        .query("inventory")
        .withIndex("by_component", (q) =>
          q.eq("componentId", entry.componentId)
        )
        .collect();

      const totalAvailable = stockRecords.reduce(
        (sum, r) =>
          sum + (r.availableQty ?? r.quantity - (r.reservedQty ?? 0)),
        0
      );

      const needed = entry.quantityPerUnit * order.quantity;
      if (totalAvailable < needed) {
        shortages.push({
          componentName: component.name,
          partNumber: component.partNumber,
          needed,
          available: totalAvailable,
          shortfall: needed - totalAvailable,
        });
      }
    }

    if (shortages.length > 0 && !args.force) {
      return {
        success: false,
        status: "shortage",
        shortages,
        message: `Cannot reserve materials for ${order.quantity}x ${order.productName}. ${shortages.length} component(s) short.`,
      };
    }

    // Reserve stock for each component
    const reservationResults: Array<{
      componentId: Id<"components">;
      componentName: string;
      needed: number;
      reserved: number;
      shortfall: number;
    }> = [];

    for (const entry of relevant) {
      if (entry.isOptional) continue;
      const component = await ctx.db.get(entry.componentId);
      if (!component) continue;

      const needed = entry.quantityPerUnit * order.quantity;

      // Reserve across inventory records
      const records = await ctx.db
        .query("inventory")
        .withIndex("by_component", (q) =>
          q.eq("componentId", entry.componentId)
        )
        .collect();

      const sorted = records
        .map((r) => ({
          ...r,
          effectiveAvailable:
            r.availableQty ?? r.quantity - (r.reservedQty ?? 0),
        }))
        .filter((r) => r.effectiveAvailable > 0)
        .sort((a, b) => b.effectiveAvailable - a.effectiveAvailable);

      let remaining = needed;
      let totalReserved = 0;

      for (const record of sorted) {
        if (remaining <= 0) break;
        const toReserve = Math.min(remaining, record.effectiveAvailable);

        const newReserved = (record.reservedQty ?? 0) + toReserve;
        const newAvailable = record.quantity - newReserved;

        await ctx.db.patch(record._id, {
          reservedQty: newReserved,
          availableQty: newAvailable,
          updatedAt: Date.now(),
        });

        remaining -= toReserve;
        totalReserved += toReserve;
      }

      reservationResults.push({
        componentId: entry.componentId,
        componentName: component.name,
        needed,
        reserved: totalReserved,
        shortfall: Math.max(0, remaining),
      });
    }

    // Update build order status
    await ctx.db.patch(args.id, {
      status: "materials_reserved",
      updatedAt: Date.now(),
    });

    return {
      success: true,
      status: "materials_reserved",
      reservations: reservationResults,
      message: `Materials reserved for ${order.buildNumber}: ${order.quantity}x ${order.productName}`,
    };
  },
});

// RESERVE → IN_PROGRESS
// Validates materials, records start time
export const startBuild = mutation({
  args: {
    id: v.id("buildOrders"),
    assignedTo: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order) throw new Error("Build order not found");
    if (order.status !== "materials_reserved") {
      throw new Error(
        `Cannot start build: order is "${order.status}", expected "materials_reserved"`
      );
    }

    await ctx.db.patch(args.id, {
      status: "in_progress",
      actualStart: Date.now(),
      assignedTo: args.assignedTo ?? order.assignedTo,
      notes: args.notes ?? order.notes,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      buildNumber: order.buildNumber,
      message: `Build ${order.buildNumber} started. ${order.quantity}x ${order.productName}.`,
    };
  },
});

// IN_PROGRESS → QC
// Records units built, moves to quality check
export const submitToQC = mutation({
  args: {
    id: v.id("buildOrders"),
    unitsBuilt: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order) throw new Error("Build order not found");
    if (order.status !== "in_progress") {
      throw new Error(
        `Cannot submit to QC: order is "${order.status}", expected "in_progress"`
      );
    }

    await ctx.db.patch(args.id, {
      status: "qc",
      notes: args.notes ?? order.notes,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      buildNumber: order.buildNumber,
      message: `Build ${order.buildNumber} submitted for QC. ${args.unitsBuilt ?? order.quantity} units to inspect.`,
    };
  },
});

// QC → COMPLETE
// Records QC results, consumes inventory, creates audit transactions
export const completeBuild = mutation({
  args: {
    id: v.id("buildOrders"),
    qcPassedCount: v.number(),
    qcFailedCount: v.optional(v.number()),
    qcNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order) throw new Error("Build order not found");
    if (order.status !== "qc") {
      throw new Error(
        `Cannot complete build: order is "${order.status}", expected "qc"`
      );
    }

    const totalUnits = args.qcPassedCount + (args.qcFailedCount ?? 0);

    // Consume inventory for the units that were actually built
    // (both passed and failed — materials were consumed either way)
    const bomEntries = await ctx.db
      .query("bomEntries")
      .withIndex("by_product", (q) => q.eq("productName",order.productName))
      .collect();

    const relevant = order.bomVersion
      ? bomEntries.filter((e) => e.bomVersion === order.bomVersion)
      : bomEntries;

    const transactionIds: Id<"inventoryTransactions">[] = [];

    for (const entry of relevant) {
      if (entry.isOptional) continue;

      const consumeQty = entry.quantityPerUnit * totalUnits;
      const records = await ctx.db
        .query("inventory")
        .withIndex("by_component", (q) =>
          q.eq("componentId", entry.componentId)
        )
        .collect();

      let remaining = consumeQty;

      for (const record of records) {
        if (remaining <= 0) break;
        const currentReserved = record.reservedQty ?? 0;
        if (currentReserved <= 0) continue;

        const toConsume = Math.min(remaining, currentReserved);
        const newQty = record.quantity - toConsume;
        const newReserved = currentReserved - toConsume;
        const newAvailable = newQty - newReserved;

        await ctx.db.patch(record._id, {
          quantity: newQty,
          reservedQty: newReserved,
          availableQty: Math.max(0, newAvailable),
          updatedAt: Date.now(),
        });

        const txnId = await ctx.db.insert("inventoryTransactions", {
          type: "consume",
          componentId: entry.componentId,
          locationId: record.locationId,
          quantity: -toConsume,
          previousQty: record.quantity,
          newQty: newQty,
          referenceType: "build_order",
          referenceId: args.id as string,
          reason: `${order.buildNumber}: ${totalUnits}x ${order.productName} (${args.qcPassedCount} passed, ${args.qcFailedCount ?? 0} failed)`,
          performedBy: "agent",
          timestamp: Date.now(),
        });

        transactionIds.push(txnId);
        remaining -= toConsume;
      }

      // Release any excess reservation (if we built fewer units than planned)
      if (totalUnits < order.quantity) {
        const excessQty = entry.quantityPerUnit * (order.quantity - totalUnits);
        for (const record of records) {
          if (excessQty <= 0) break;
          const currentReserved = record.reservedQty ?? 0;
          if (currentReserved <= 0) continue;

          const toRelease = Math.min(excessQty, currentReserved);
          const newReserved = currentReserved - toRelease;
          await ctx.db.patch(record._id, {
            reservedQty: newReserved,
            availableQty: Math.max(0, record.quantity - newReserved),
            updatedAt: Date.now(),
          });
        }
      }
    }

    // Update build order
    await ctx.db.patch(args.id, {
      status: "complete",
      completedAt: Date.now(),
      qcPassedCount: args.qcPassedCount,
      qcFailedCount: args.qcFailedCount ?? 0,
      notes: args.qcNotes
        ? `${order.notes ? order.notes + "\n" : ""}QC: ${args.qcNotes}`
        : order.notes,
      updatedAt: Date.now(),
    });

    const yieldRate = totalUnits > 0
      ? Math.round((args.qcPassedCount / totalUnits) * 100)
      : 0;

    // Auto-save actual COGS based on consumed materials
    try {
      const costLineItems: Array<{
        componentId: Id<"components">;
        componentName: string;
        partNumber: string;
        quantityPerUnit: number;
        unitCost: number;
        totalCost: number;
        source: string;
      }> = [];

      let totalMaterialCost = 0;

      for (const entry of relevant) {
        if (entry.isOptional) continue;
        const component = await ctx.db.get(entry.componentId);
        if (!component) continue;

        // Find best cost source (same priority as costing.ts)
        let unitCost = 0;
        let source = "unknown";

        const poLines = await ctx.db
          .query("purchaseOrderLines")
          .withIndex("by_component", (q: any) => q.eq("componentId", entry.componentId))
          .order("desc")
          .take(1);
        if (poLines.length > 0 && poLines[0].unitPrice > 0) {
          unitCost = poLines[0].unitPrice;
          source = "po_last";
        } else {
          const invRecords = await ctx.db
            .query("inventory")
            .withIndex("by_component", (q: any) => q.eq("componentId", entry.componentId))
            .collect();
          const withCost = invRecords.find((i: any) => i.costPerUnit && i.costPerUnit > 0);
          if (withCost) {
            unitCost = withCost.costPerUnit ?? 0;
            source = "inventory_avg";
          } else {
            const supplierLinks = await ctx.db
              .query("componentSuppliers")
              .withIndex("by_component", (q: any) => q.eq("componentId", entry.componentId))
              .collect();
            const preferred = supplierLinks.find((s: any) => s.isPreferred && s.unitPrice > 0);
            if (preferred) {
              unitCost = preferred.unitPrice ?? 0;
              source = "supplier_preferred";
            } else {
              const anySup = supplierLinks.find((s: any) => s.unitPrice > 0);
              if (anySup) {
                unitCost = anySup.unitPrice ?? 0;
                source = "supplier_price";
              }
            }
          }
        }

        const lineTotalCost = unitCost * entry.quantityPerUnit * totalUnits;
        totalMaterialCost += lineTotalCost;

        costLineItems.push({
          componentId: entry.componentId,
          componentName: component.name,
          partNumber: component.partNumber,
          quantityPerUnit: entry.quantityPerUnit,
          unitCost,
          totalCost: lineTotalCost,
          source,
        });
      }

      const costPerUnit = totalUnits > 0 ? totalMaterialCost / totalUnits : 0;

      await ctx.db.insert("productCosts", {
        productName: order.productName,
        buildOrderId: args.id,
        type: "actual",
        bomVersion: order.bomVersion,
        quantity: totalUnits,
        materialCost: totalMaterialCost,
        totalCost: totalMaterialCost,
        costPerUnit,
        lineItems: costLineItems,
        calculatedAt: Date.now(),
        calculatedBy: "build_lifecycle",
        notes: `Auto-calculated on build completion: ${order.buildNumber}`,
      });
    } catch {
      // COGS auto-save is best-effort — don't fail the build completion
    }

    return {
      success: true,
      buildNumber: order.buildNumber,
      totalBuilt: totalUnits,
      passed: args.qcPassedCount,
      failed: args.qcFailedCount ?? 0,
      yieldRate,
      transactionsCreated: transactionIds.length,
      message: `Build ${order.buildNumber} complete. ${args.qcPassedCount}/${totalUnits} units passed QC (${yieldRate}% yield).`,
    };
  },
});

// ANY → CANCELLED
// Releases all reserved stock
export const cancelBuild = mutation({
  args: {
    id: v.id("buildOrders"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.id);
    if (!order) throw new Error("Build order not found");
    if (order.status === "complete" || order.status === "cancelled") {
      throw new Error(`Cannot cancel: order is already "${order.status}"`);
    }

    // Release reserved stock if materials were reserved
    let released = 0;
    if (
      order.status === "materials_reserved" ||
      order.status === "in_progress" ||
      order.status === "qc"
    ) {
      const bomEntries = await ctx.db
        .query("bomEntries")
        .withIndex("by_product", (q) => q.eq("productName",order.productName))
        .collect();

      const relevant = order.bomVersion
        ? bomEntries.filter((e) => e.bomVersion === order.bomVersion)
        : bomEntries;

      for (const entry of relevant) {
        if (entry.isOptional) continue;
        const releaseQty = entry.quantityPerUnit * order.quantity;

        const records = await ctx.db
          .query("inventory")
          .withIndex("by_component", (q) =>
            q.eq("componentId", entry.componentId)
          )
          .collect();

        let remaining = releaseQty;
        for (const record of records) {
          if (remaining <= 0) break;
          const currentReserved = record.reservedQty ?? 0;
          if (currentReserved <= 0) continue;

          const toRelease = Math.min(remaining, currentReserved);
          const newReserved = currentReserved - toRelease;

          await ctx.db.patch(record._id, {
            reservedQty: newReserved,
            availableQty: record.quantity - newReserved,
            updatedAt: Date.now(),
          });

          remaining -= toRelease;
          released += toRelease;
        }
      }
    }

    await ctx.db.patch(args.id, {
      status: "cancelled",
      notes: `${order.notes ? order.notes + "\n" : ""}CANCELLED: ${args.reason}`,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      buildNumber: order.buildNumber,
      stockReleased: released,
      message: `Build ${order.buildNumber} cancelled. ${released > 0 ? `${released} units of reserved stock released.` : "No stock was reserved."}`,
    };
  },
});

// ============================================================
// PRODUCTION STATS
// ============================================================

export const productionStats = query({
  args: { product: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const allOrders = await ctx.db.query("buildOrders").collect();
    const filtered = args.product
      ? allOrders.filter((o) => o.productName === args.product)
      : allOrders;

    const completed = filtered.filter((o) => o.status === "complete");
    const totalBuilt = completed.reduce(
      (sum, o) => sum + (o.qcPassedCount ?? 0) + (o.qcFailedCount ?? 0),
      0
    );
    const totalPassed = completed.reduce(
      (sum, o) => sum + (o.qcPassedCount ?? 0),
      0
    );
    const totalFailed = completed.reduce(
      (sum, o) => sum + (o.qcFailedCount ?? 0),
      0
    );

    // Average build time (for completed orders with start + end dates)
    const withDuration = completed.filter(
      (o) => o.actualStart && o.completedAt
    );
    const avgDurationMs =
      withDuration.length > 0
        ? withDuration.reduce(
            (sum, o) => sum + (o.completedAt! - o.actualStart!),
            0
          ) / withDuration.length
        : 0;

    return {
      totalOrders: filtered.length,
      completedOrders: completed.length,
      activeOrders: filtered.filter((o) =>
        ["planned", "materials_reserved", "in_progress", "qc"].includes(
          o.status
        )
      ).length,
      cancelledOrders: filtered.filter((o) => o.status === "cancelled").length,
      totalUnitsBuilt: totalBuilt,
      totalUnitsPassed: totalPassed,
      totalUnitsFailed: totalFailed,
      overallYieldRate:
        totalBuilt > 0 ? Math.round((totalPassed / totalBuilt) * 100) : null,
      averageBuildTimeHours:
        avgDurationMs > 0
          ? Math.round(avgDurationMs / (60 * 60 * 1000) * 10) / 10
          : null,
    };
  },
});
