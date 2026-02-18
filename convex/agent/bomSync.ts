import { v } from "convex/values";
import {
  mutation,
  query,
  action,
  internalMutation,
  internalQuery,
  internalAction,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { Id, Doc } from "../_generated/dataModel";

// ============================================================
// BOM SYNC — Cross-System Intelligence Engine
// ============================================================
//
// The Flow:
// 1. Drive sync detects a BOM file was modified (driveFiles.category === "bom")
// 2. This module is triggered to process the change
// 3. We parse the BOM content, diff against the last known snapshot
// 4. For each change, we evaluate inventory impact
// 5. We create tasks/alerts for humans and update bomEntries
//
// This is the brain that connects Google Drive ↔ Inventory.

// ---- Types ----

interface ParsedBomEntry {
  partNumber?: string;
  name: string;
  quantity: number;
  referenceDesignator?: string;
  notes?: string;
}

interface BomDiffResult {
  added: ParsedBomEntry[];
  removed: ParsedBomEntry[];
  quantityChanged: Array<{
    entry: ParsedBomEntry;
    previousQty: number;
    newQty: number;
  }>;
  substituted: Array<{
    previous: ParsedBomEntry;
    replacement: ParsedBomEntry;
  }>;
  unchanged: ParsedBomEntry[];
}

// ============================================================
// QUERIES
// ============================================================

// Get all BOM change logs, optionally filtered by product or status
export const listChangeLogs = query({
  args: {
    product: v.optional(v.string()),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q;
    if (args.product && args.status) {
      q = ctx.db
        .query("bomChangeLogs")
        .withIndex("by_product_status", (q) =>
          q.eq("product", args.product!).eq("status", args.status as any)
        );
    } else if (args.product) {
      q = ctx.db
        .query("bomChangeLogs")
        .withIndex("by_product", (q) => q.eq("product", args.product!));
    } else if (args.status) {
      q = ctx.db
        .query("bomChangeLogs")
        .withIndex("by_status", (q) => q.eq("status", args.status as any));
    } else {
      q = ctx.db
        .query("bomChangeLogs")
        .withIndex("by_detectedAt");
    }

    return await q.order("desc").take(args.limit ?? 50);
  },
});

// Get unresolved changes that need attention
export const pendingChanges = query({
  handler: async (ctx) => {
    const detected = await ctx.db
      .query("bomChangeLogs")
      .withIndex("by_status", (q) => q.eq("status", "detected"))
      .collect();
    const requiresHuman = await ctx.db
      .query("bomChangeLogs")
      .withIndex("by_status", (q) => q.eq("status", "requires_human"))
      .collect();
    return { detected, requiresHuman, total: detected.length + requiresHuman.length };
  },
});

// Get the latest BOM snapshot for a product
export const getLatestSnapshot = query({
  args: { product: v.string() },
  handler: async (ctx, args) => {
    const snapshots = await ctx.db
      .query("bomSnapshots")
      .withIndex("by_product", (q) => q.eq("productName", args.product))
      .order("desc")
      .take(1);
    return snapshots[0] ?? null;
  },
});

// Dashboard: BOM sync health overview
export const syncOverview = query({
  handler: async (ctx) => {
    const allLogs = await ctx.db.query("bomChangeLogs").collect();
    const last24h = Date.now() - 24 * 60 * 60 * 1000;

    const recentChanges = allLogs.filter((l) => l.detectedAt > last24h);
    const unresolved = allLogs.filter(
      (l) => l.status === "detected" || l.status === "requires_human"
    );
    const errors = allLogs.filter(
      (l) => l.status === "error" && l.detectedAt > last24h
    );

    // Group unresolved by product
    const byProduct: Record<string, number> = {};
    for (const log of unresolved) {
      byProduct[log.product] = (byProduct[log.product] ?? 0) + 1;
    }

    return {
      changesLast24h: recentChanges.length,
      unresolvedCount: unresolved.length,
      errorsLast24h: errors.length,
      unresolvedByProduct: byProduct,
    };
  },
});

// ============================================================
// INTERNAL QUERIES — Used by actions
// ============================================================

// Find a component by part number
export const _findComponentByPartNumber = internalQuery({
  args: { partNumber: v.string() },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("components")
      .withIndex("by_partNumber", (q) => q.eq("partNumber", args.partNumber))
      .take(1);
    return results[0] ?? null;
  },
});

// Find a component by name (fuzzy fallback when no part number)
export const _findComponentByName = internalQuery({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    // Use search index for fuzzy matching
    const results = await ctx.db
      .query("components")
      .withSearchIndex("search_components", (q) => q.search("name", args.name))
      .take(5);
    return results;
  },
});

// Get current BOM entries for a product
export const _getBomEntriesForProduct = internalQuery({
  args: { product: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bomEntries")
      .withIndex("by_product", (q) => q.eq("productName", args.product))
      .collect();
  },
});

// Get the latest snapshot for a product
export const _getLatestSnapshot = internalQuery({
  args: { product: v.string() },
  handler: async (ctx, args) => {
    const snapshots = await ctx.db
      .query("bomSnapshots")
      .withIndex("by_product", (q) => q.eq("productName", args.product))
      .order("desc")
      .take(1);
    return snapshots[0] ?? null;
  },
});

// Get stock levels for a component
export const _getStockForComponent = internalQuery({
  args: { componentId: v.id("components") },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("inventory")
      .withIndex("by_component", (q) => q.eq("componentId", args.componentId))
      .collect();
    const totalAvailable = records.reduce(
      (sum, r) => sum + (r.availableQty ?? r.quantity),
      0
    );
    return { records, totalAvailable };
  },
});

// Get preferred supplier for a component
export const _getPreferredSupplier = internalQuery({
  args: { componentId: v.id("components") },
  handler: async (ctx, args) => {
    const links = await ctx.db
      .query("componentSuppliers")
      .withIndex("by_component", (q) => q.eq("componentId", args.componentId))
      .collect();
    const preferred = links.find((l) => l.isPreferred);
    if (!preferred) return links[0] ?? null;
    const supplier = await ctx.db.get(preferred.supplierId);
    return { ...preferred, supplierName: supplier?.name };
  },
});

// Get a driveFile by its Convex ID
export const _getDriveFile = internalQuery({
  args: { id: v.id("driveFiles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get BOM-category driveFiles modified since a given timestamp
export const _getRecentBomChanges = internalQuery({
  args: { since: v.number() },
  handler: async (ctx, args) => {
    const allBomFiles = await ctx.db
      .query("driveFiles")
      .withIndex("by_folderType", (q) => q.eq("folderType", "BOM"))
      .collect();
    return allBomFiles.filter((f) => (f.modifiedTime ?? 0) > args.since);
  },
});

// ============================================================
// INTERNAL MUTATIONS — Used by the sync pipeline
// ============================================================

// Create a BOM change log entry
export const _createChangeLog = internalMutation({
  args: {
    driveFileId: v.optional(v.id("driveFiles")),
    driveId: v.optional(v.string()),
    product: v.string(),
    bomVersion: v.optional(v.string()),
    changeType: v.union(
      v.literal("component_added"),
      v.literal("component_removed"),
      v.literal("component_substituted"),
      v.literal("quantity_changed"),
      v.literal("new_bom_detected"),
      v.literal("bom_parse_error")
    ),
    componentPartNumber: v.optional(v.string()),
    componentName: v.optional(v.string()),
    previousValue: v.optional(v.string()),
    newValue: v.optional(v.string()),
    status: v.union(
      v.literal("detected"),
      v.literal("processing"),
      v.literal("resolved"),
      v.literal("requires_human"),
      v.literal("error")
    ),
    resolution: v.optional(v.string()),
    inventoryImpact: v.optional(
      v.object({
        componentId: v.optional(v.id("components")),
        currentStock: v.optional(v.number()),
        requiredPerUnit: v.optional(v.number()),
        shortfall: v.optional(v.number()),
        estimatedCost: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("bomChangeLogs", {
      ...args,
      detectedAt: Date.now(),
      processedBy: "agent",
    });
  },
});

// Update a change log entry's status
export const _updateChangeLogStatus = internalMutation({
  args: {
    id: v.id("bomChangeLogs"),
    status: v.union(
      v.literal("detected"),
      v.literal("processing"),
      v.literal("resolved"),
      v.literal("requires_human"),
      v.literal("error")
    ),
    resolution: v.optional(v.string()),
    taskId: v.optional(v.id("tasks")),
    alertId: v.optional(v.id("alerts")),
    inventoryImpact: v.optional(
      v.object({
        componentId: v.optional(v.id("components")),
        currentStock: v.optional(v.number()),
        requiredPerUnit: v.optional(v.number()),
        shortfall: v.optional(v.number()),
        estimatedCost: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args;
    const updates: any = { ...patch };
    if (
      patch.status === "resolved" ||
      patch.status === "requires_human" ||
      patch.status === "error"
    ) {
      updates.resolvedAt = Date.now();
    }
    await ctx.db.patch(id, updates);
  },
});

// Save a BOM snapshot
export const _saveBomSnapshot = internalMutation({
  args: {
    product: v.string(),
    bomVersion: v.optional(v.string()),
    driveFileId: v.optional(v.id("driveFiles")),
    driveId: v.optional(v.string()),
    entries: v.array(
      v.object({
        partNumber: v.optional(v.string()),
        name: v.string(),
        quantity: v.number(),
        referenceDesignator: v.optional(v.string()),
        notes: v.optional(v.string()),
      })
    ),
    contentHash: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("bomSnapshots", {
      ...args,
      snapshotAt: Date.now(),
    });
  },
});

// Create a task via the agent system
export const _createTask = internalMutation({
  args: {
    title: v.string(),
    description: v.string(),
    priority: v.union(
      v.literal("low"),
      v.literal("normal"),
      v.literal("high"),
      v.literal("urgent")
    ),
    category: v.string(),
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const typeMap: Record<string, string> = {
      "drive": "review_bom",
      "inventory": "general",
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

// Create an alert via the agent system
export const _createAlert = internalMutation({
  args: {
    type: v.string(),
    severity: v.union(
      v.literal("info"),
      v.literal("warning"),
      v.literal("critical")
    ),
    title: v.string(),
    message: v.string(),
    relatedEntityType: v.optional(v.string()),
    relatedEntityId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("alerts", {
      type: args.type,
      severity: args.severity,
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

// Upsert a bomEntry
export const _upsertBomEntry = internalMutation({
  args: {
    product: v.string(),
    bomVersion: v.string(),
    componentId: v.id("components"),
    quantity: v.number(),
    referenceDesignator: v.optional(v.string()),
    isOptional: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if entry already exists for this product + component
    const existing = await ctx.db
      .query("bomEntries")
      .withIndex("by_product", (q) => q.eq("productName", args.product))
      .collect();

    const match = existing.find(
      (e) =>
        e.componentId === args.componentId &&
        e.bomVersion === args.bomVersion
    );

    if (match) {
      await ctx.db.patch(match._id, {
        quantityPerUnit: args.quantity,
        referenceDesignator: args.referenceDesignator,
        notes: args.notes,
        updatedAt: Date.now(),
      });
      return { action: "updated", id: match._id };
    } else {
      const id = await ctx.db.insert("bomEntries", {
        productName: args.product,
        bomVersion: args.bomVersion,
        componentId: args.componentId,
        quantityPerUnit: args.quantity,
        referenceDesignator: args.referenceDesignator,
        isOptional: args.isOptional ?? false,
        substituteComponentIds: [],
        notes: args.notes,
        updatedAt: Date.now(),
      });
      return { action: "created", id };
    }
  },
});

// ============================================================
// MUTATION: Manual trigger for BOM reconciliation
// ============================================================

// Human-facing mutation: resolve a BOM change log
export const resolveChangeLog = mutation({
  args: {
    id: v.id("bomChangeLogs"),
    resolution: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: "resolved",
      resolution: args.resolution,
      resolvedAt: Date.now(),
    });
  },
});

// ============================================================
// ACTIONS — The Intelligence Pipeline
// ============================================================

// Main entry point: Process a BOM file change detected by Drive sync
export const processBomFileChange = internalAction({
  args: {
    driveFileId: v.id("driveFiles"),
    bomContent: v.string(), // Raw BOM content (from Drive MCP read)
    product: v.string(),
  },
  handler: async (ctx, args) => {
    const { driveFileId, bomContent, product } = args;

    // 1. Get the driveFile record
    const driveFile = await ctx.runQuery(
      internal.agent.bomSync._getDriveFile,
      { id: driveFileId }
    );

    // 2. Parse the BOM content
    const parsedEntries = parseBomContent(bomContent);

    if (parsedEntries.length === 0) {
      // Couldn't parse — log error and create task for human
      const logId = await ctx.runMutation(
        internal.agent.bomSync._createChangeLog,
        {
          driveFileId,
          driveId: driveFile?.driveFileId,
          product,
          changeType: "bom_parse_error",
          status: "requires_human",
          resolution:
            "Could not parse BOM content. File may be in an unexpected format.",
        }
      );
      await ctx.runMutation(internal.agent.bomSync._createTask, {
        title: `BOM parse error: ${product}`,
        description: `The BOM file for ${product} was modified but couldn't be automatically parsed. Please review the file in Google Drive and update the inventory system manually.\n\nFile: ${driveFile?.name ?? "unknown"}\nPath: ${driveFile?.path ?? "unknown"}`,
        priority: "normal",
        category: "drive",
        relatedEntityType: "bomChangeLog",
        relatedEntityId: logId,
      });
      return { success: false, reason: "parse_error", entries: 0 };
    }

    // 3. Compute content hash to detect if anything actually changed
    const contentHash = computeContentHash(parsedEntries);

    // 4. Get the previous snapshot
    const previousSnapshot = await ctx.runQuery(
      internal.agent.bomSync._getLatestSnapshot,
      { product }
    );

    // 5. If content hash matches, nothing changed — skip
    if (previousSnapshot && previousSnapshot.contentHash === contentHash) {
      return { success: true, reason: "no_changes", entries: parsedEntries.length };
    }

    // 6. Diff against previous snapshot (or treat as new if no snapshot)
    const diff = previousSnapshot
      ? diffBom(previousSnapshot.entries, parsedEntries)
      : {
          added: parsedEntries,
          removed: [],
          quantityChanged: [],
          substituted: [],
          unchanged: [],
        };

    // 7. Save new snapshot
    await ctx.runMutation(internal.agent.bomSync._saveBomSnapshot, {
      product,
      driveFileId,
      driveId: driveFile?.driveFileId,
      entries: parsedEntries,
      contentHash,
    });

    // 8. Process each type of change
    const results = {
      added: 0,
      removed: 0,
      quantityChanged: 0,
      substituted: 0,
      tasksCreated: 0,
      alertsCreated: 0,
    };

    // --- New components added ---
    for (const entry of diff.added) {
      results.added++;
      await processAddedComponent(ctx, {
        entry,
        product,
        driveFileId,
        driveId: driveFile?.driveFileId,
        isNewBom: !previousSnapshot,
      });
    }

    // --- Components removed ---
    for (const entry of diff.removed) {
      results.removed++;
      const logId = await ctx.runMutation(
        internal.agent.bomSync._createChangeLog,
        {
          driveFileId,
          driveId: driveFile?.driveFileId,
          product,
          changeType: "component_removed",
          componentPartNumber: entry.partNumber,
          componentName: entry.name,
          previousValue: `qty: ${entry.quantity}`,
          status: "requires_human",
        }
      );
      const taskId = await ctx.runMutation(
        internal.agent.bomSync._createTask,
        {
          title: `BOM change: ${entry.name} removed from ${product}`,
          description: `The component "${entry.name}"${entry.partNumber ? ` (${entry.partNumber})` : ""} was removed from the ${product} BOM.\n\nPlease verify:\n1. Was this intentional?\n2. Do we need to update firmware or hardware designs?\n3. Should reserved stock for upcoming builds be released?\n4. Update the bomEntries in the inventory system.`,
          priority: "normal",
          category: "inventory",
          relatedEntityType: "bomChangeLog",
          relatedEntityId: logId,
        }
      );
      await ctx.runMutation(
        internal.agent.bomSync._updateChangeLogStatus,
        { id: logId, taskId }
      );
      results.tasksCreated++;
    }

    // --- Quantity changes ---
    for (const change of diff.quantityChanged) {
      results.quantityChanged++;
      await processQuantityChange(ctx, {
        change,
        product,
        driveFileId,
        driveId: driveFile?.driveFileId,
      });
    }

    // --- Substitutions ---
    for (const sub of diff.substituted) {
      results.substituted++;
      const logId = await ctx.runMutation(
        internal.agent.bomSync._createChangeLog,
        {
          driveFileId,
          driveId: driveFile?.driveFileId,
          product,
          changeType: "component_substituted",
          componentPartNumber: sub.replacement.partNumber,
          componentName: sub.replacement.name,
          previousValue: `${sub.previous.name}${sub.previous.partNumber ? ` (${sub.previous.partNumber})` : ""}`,
          newValue: `${sub.replacement.name}${sub.replacement.partNumber ? ` (${sub.replacement.partNumber})` : ""}`,
          status: "requires_human",
        }
      );
      const taskId = await ctx.runMutation(
        internal.agent.bomSync._createTask,
        {
          title: `Component substitution in ${product}: ${sub.previous.name} → ${sub.replacement.name}`,
          description: `A component substitution was detected in the ${product} BOM.\n\nOld: ${sub.previous.name}${sub.previous.partNumber ? ` (${sub.previous.partNumber})` : ""}\nNew: ${sub.replacement.name}${sub.replacement.partNumber ? ` (${sub.replacement.partNumber})` : ""}\n\nAction needed:\n1. Verify the new component exists in the inventory system (add if not)\n2. Upload datasheet for new component to Drive\n3. Check firmware compatibility — interface code may need updating\n4. Update supplier info and pricing\n5. Review stock levels for the new component`,
          priority: "high",
          category: "inventory",
          relatedEntityType: "bomChangeLog",
          relatedEntityId: logId,
        }
      );
      await ctx.runMutation(
        internal.agent.bomSync._updateChangeLogStatus,
        { id: logId, taskId }
      );
      results.tasksCreated++;
    }

    // 9. If this was a new BOM (first snapshot), create a summary alert
    if (!previousSnapshot && parsedEntries.length > 0) {
      const alertId = await ctx.runMutation(
        internal.agent.bomSync._createAlert,
        {
          type: "structure_violation",
          severity: "info",
          title: `New BOM indexed: ${product}`,
          message: `First BOM snapshot created for ${product} with ${parsedEntries.length} components. The inventory system will now track changes to this BOM automatically.`,
          relatedEntityType: "driveFile",
          relatedEntityId: driveFileId,
        }
      );
      results.alertsCreated++;
    }

    return { success: true, reason: "processed", ...results };
  },
});

// Process a single added component
async function processAddedComponent(
  ctx: any,
  args: {
    entry: ParsedBomEntry;
    product: string;
    driveFileId: Id<"driveFiles">;
    driveId?: string;
    isNewBom: boolean;
  }
) {
  const { entry, product, driveFileId, driveId, isNewBom } = args;

  // Check if component already exists in our system
  let existingComponent = null;
  if (entry.partNumber) {
    existingComponent = await ctx.runQuery(
      internal.agent.bomSync._findComponentByPartNumber,
      { partNumber: entry.partNumber }
    );
  }

  if (!existingComponent && entry.name) {
    const nameMatches = await ctx.runQuery(
      internal.agent.bomSync._findComponentByName,
      { name: entry.name }
    );
    // Only use name match if it's a strong match (first result)
    if (nameMatches.length > 0) {
      existingComponent = nameMatches[0];
    }
  }

  if (existingComponent) {
    // Component exists — check stock and auto-update BOM entry
    const stock = await ctx.runQuery(
      internal.agent.bomSync._getStockForComponent,
      { componentId: existingComponent._id }
    );

    const logId = await ctx.runMutation(
      internal.agent.bomSync._createChangeLog,
      {
        driveFileId,
        driveId,
        product,
        changeType: isNewBom ? "new_bom_detected" : "component_added",
        componentPartNumber:
          entry.partNumber ?? existingComponent.partNumber,
        componentName: entry.name,
        newValue: `qty: ${entry.quantity}`,
        status: "resolved",
        resolution: `Component found in inventory system. Current stock: ${stock.totalAvailable} units.`,
        inventoryImpact: {
          componentId: existingComponent._id,
          currentStock: stock.totalAvailable,
          requiredPerUnit: entry.quantity,
        },
      }
    );
  } else {
    // Component NOT found — this is the key "new component detection" feature
    const logId = await ctx.runMutation(
      internal.agent.bomSync._createChangeLog,
      {
        driveFileId,
        driveId,
        product,
        changeType: "component_added",
        componentPartNumber: entry.partNumber,
        componentName: entry.name,
        newValue: `qty: ${entry.quantity}`,
        status: "requires_human",
      }
    );

    const taskId = await ctx.runMutation(
      internal.agent.bomSync._createTask,
      {
        title: `New component needed: ${entry.name}`,
        description: `A new component was detected in the ${product} BOM that doesn't exist in the inventory system.\n\nComponent: ${entry.name}${entry.partNumber ? `\nPart Number: ${entry.partNumber}` : ""}\nQuantity per unit: ${entry.quantity}${entry.referenceDesignator ? `\nReference: ${entry.referenceDesignator}` : ""}\n\nAction needed:\n1. Search DigiKey/Mouser for pricing and availability\n2. Add the component to the inventory system with proper categorization\n3. Upload datasheet to Products/${product}/Datasheets/ in Google Drive\n4. Set up preferred supplier and pricing\n5. Order initial stock if builds are planned`,
        priority: "high",
        category: "inventory",
        relatedEntityType: "bomChangeLog",
        relatedEntityId: logId,
        dueDate: Date.now() + 3 * 24 * 60 * 60 * 1000, // Due in 3 days (maps to dueAt in handler)
      }
    );

    await ctx.runMutation(
      internal.agent.bomSync._updateChangeLogStatus,
      {
        id: logId,
        status: "requires_human",
        taskId,
      }
    );
  }
}

// Process a quantity change
async function processQuantityChange(
  ctx: any,
  args: {
    change: {
      entry: ParsedBomEntry;
      previousQty: number;
      newQty: number;
    };
    product: string;
    driveFileId: Id<"driveFiles">;
    driveId?: string;
  }
) {
  const { change, product, driveFileId, driveId } = args;

  // Try to find the component to check inventory impact
  let component = null;
  if (change.entry.partNumber) {
    component = await ctx.runQuery(
      internal.agent.bomSync._findComponentByPartNumber,
      { partNumber: change.entry.partNumber }
    );
  }

  let inventoryImpact = undefined;
  let stockMessage = "";

  if (component) {
    const stock = await ctx.runQuery(
      internal.agent.bomSync._getStockForComponent,
      { componentId: component._id }
    );

    inventoryImpact = {
      componentId: component._id,
      currentStock: stock.totalAvailable,
      requiredPerUnit: change.newQty,
    };

    if (change.newQty > change.previousQty) {
      stockMessage = `\n\nInventory impact: Quantity per unit increased from ${change.previousQty} to ${change.newQty}. Current stock: ${stock.totalAvailable} units. This may affect build feasibility.`;
    } else {
      stockMessage = `\n\nInventory impact: Quantity per unit decreased from ${change.previousQty} to ${change.newQty}. Current stock: ${stock.totalAvailable} units. More units can be built with existing stock.`;
    }
  }

  const severity =
    change.newQty > change.previousQty ? "warning" : "info";
  const isSignificant =
    Math.abs(change.newQty - change.previousQty) / change.previousQty > 0.5;

  const logId = await ctx.runMutation(
    internal.agent.bomSync._createChangeLog,
    {
      driveFileId,
      driveId,
      product,
      changeType: "quantity_changed",
      componentPartNumber: change.entry.partNumber,
      componentName: change.entry.name,
      previousValue: `qty: ${change.previousQty}`,
      newValue: `qty: ${change.newQty}`,
      status: isSignificant ? "requires_human" : "resolved",
      resolution: isSignificant
        ? undefined
        : `Minor quantity change (${change.previousQty} → ${change.newQty}). Auto-resolved.`,
      inventoryImpact,
    }
  );

  // Only create tasks/alerts for significant changes
  if (isSignificant) {
    const alertId = await ctx.runMutation(
      internal.agent.bomSync._createAlert,
      {
        type: "low_stock",
        severity,
        title: `BOM quantity change: ${change.entry.name} in ${product}`,
        message: `Quantity per unit changed from ${change.previousQty} to ${change.newQty} for ${change.entry.name} in the ${product} BOM.${stockMessage}`,
        relatedEntityType: "bomChangeLog",
        relatedEntityId: logId,
      }
    );
    await ctx.runMutation(
      internal.agent.bomSync._updateChangeLogStatus,
      { id: logId, alertId }
    );
  }
}

// ============================================================
// BOM SCANNING CRON — Checks for BOM file changes periodically
// ============================================================

// This action is called by the cron to check for BOM changes
// since the last scan. It triggers processBomFileChange for each.
export const scanForBomChanges = internalAction({
  handler: async (ctx) => {
    // Look for BOM files modified in the last 20 minutes (slightly overlapping
    // with 15-minute cron to avoid gaps)
    const since = Date.now() - 20 * 60 * 1000;
    const recentBomFiles = await ctx.runQuery(
      internal.agent.bomSync._getRecentBomChanges,
      { since }
    );

    if (recentBomFiles.length === 0) {
      return { scanned: 0, processed: 0 };
    }

    let processed = 0;
    for (const bomFile of recentBomFiles) {
      // Determine product from the file path or product field
      const product = bomFile.productName;
      if (!product) continue;

      // NOTE: In production, this is where you'd call the Drive MCP to read
      // the actual file content. For now, we log that a change was detected
      // and the content needs to be fetched.
      //
      // The actual flow would be:
      // 1. Call drive_read via the MCP server to get BOM content
      // 2. Pass content to processBomFileChange
      //
      // For triggering manually or from Drive MCP webhook:
      //   await ctx.runAction(internal.agent.bomSync.processBomFileChange, {
      //     driveFileId: bomFile._id,
      //     bomContent: <content from MCP>,
      //     product,
      //   });

      // Create a task to process this BOM change (manual trigger for now)
      await ctx.runMutation(internal.agent.bomSync._createChangeLog, {
        driveFileId: bomFile._id,
        driveId: bomFile.driveFileId,
        product,
        changeType: "new_bom_detected",
        componentName: bomFile.name,
        status: "detected",
      });
      processed++;
    }

    return { scanned: recentBomFiles.length, processed };
  },
});

// ============================================================
// PURE FUNCTIONS — BOM Parsing & Diffing
// ============================================================

/**
 * Parse BOM content from various formats.
 * Handles:
 * - CSV/TSV format (from Google Sheets export)
 * - Markdown tables
 * - Simple line-by-line format
 *
 * Looks for columns like: Part Number, Name/Description, Quantity, Reference
 */
function parseBomContent(content: string): ParsedBomEntry[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];

  // Try CSV/TSV first (most likely from a Sheet)
  const delimiter = detectDelimiter(lines[0]);
  if (delimiter) {
    return parseCsvBom(lines, delimiter);
  }

  // Try markdown table
  if (lines[0].includes("|") && lines.length > 2 && lines[1].includes("-")) {
    return parseMarkdownBom(lines);
  }

  // Fallback: try JSON
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed
        .map((row: any) => ({
          partNumber:
            row.partNumber ?? row.part_number ?? row["Part Number"] ?? undefined,
          name:
            row.name ??
            row.description ??
            row.Name ??
            row.Description ??
            row.Component ??
            "Unknown",
          quantity: Number(
            row.quantity ?? row.qty ?? row.Quantity ?? row.Qty ?? 1
          ),
          referenceDesignator:
            row.referenceDesignator ??
            row.reference ??
            row.Reference ??
            row.Ref ??
            undefined,
          notes: row.notes ?? row.Notes ?? undefined,
        }))
        .filter((e: ParsedBomEntry) => e.name !== "Unknown" && e.quantity > 0);
    }
  } catch {
    // Not JSON
  }

  return [];
}

function detectDelimiter(headerLine: string): string | null {
  if (headerLine.includes("\t")) return "\t";
  if (headerLine.includes(",")) return ",";
  return null;
}

function parseCsvBom(lines: string[], delimiter: string): ParsedBomEntry[] {
  const headers = lines[0]
    .split(delimiter)
    .map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));

  // Map column names to our fields
  const colMap = {
    partNumber: findColumnIndex(headers, [
      "part number",
      "partnumber",
      "part_number",
      "part #",
      "part#",
      "pn",
      "mpn",
      "ccs part",
    ]),
    name: findColumnIndex(headers, [
      "name",
      "description",
      "component",
      "part name",
      "item",
      "desc",
    ]),
    quantity: findColumnIndex(headers, [
      "quantity",
      "qty",
      "count",
      "amount",
      "qty per unit",
    ]),
    reference: findColumnIndex(headers, [
      "reference",
      "ref",
      "reference designator",
      "refdes",
      "designator",
    ]),
    notes: findColumnIndex(headers, ["notes", "comment", "comments", "remarks"]),
  };

  if (colMap.name === -1 && colMap.partNumber === -1) return [];

  const entries: ParsedBomEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/['"]/g, ""));
    if (cols.every((c) => c === "")) continue; // Skip empty rows

    const name =
      (colMap.name >= 0 ? cols[colMap.name] : undefined) ??
      (colMap.partNumber >= 0 ? cols[colMap.partNumber] : undefined) ??
      "";
    if (!name) continue;

    const qty = colMap.quantity >= 0 ? Number(cols[colMap.quantity]) : 1;
    if (isNaN(qty) || qty <= 0) continue;

    entries.push({
      partNumber:
        colMap.partNumber >= 0 ? cols[colMap.partNumber] || undefined : undefined,
      name,
      quantity: qty,
      referenceDesignator:
        colMap.reference >= 0 ? cols[colMap.reference] || undefined : undefined,
      notes:
        colMap.notes >= 0 ? cols[colMap.notes] || undefined : undefined,
    });
  }

  return entries;
}

function parseMarkdownBom(lines: string[]): ParsedBomEntry[] {
  // Strip leading/trailing pipes and split
  const headers = lines[0]
    .split("|")
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length > 0);

  // Skip the separator line (line 1)
  const colMap = {
    partNumber: findColumnIndex(headers, ["part number", "partnumber", "pn"]),
    name: findColumnIndex(headers, ["name", "description", "component"]),
    quantity: findColumnIndex(headers, ["quantity", "qty", "count"]),
    reference: findColumnIndex(headers, ["reference", "ref", "refdes"]),
    notes: findColumnIndex(headers, ["notes", "comment"]),
  };

  if (colMap.name === -1) return [];

  const entries: ParsedBomEntry[] = [];
  for (let i = 2; i < lines.length; i++) {
    const cols = lines[i]
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0 || lines[i].includes("|"));

    if (cols.length === 0) continue;

    const name = colMap.name >= 0 ? cols[colMap.name] ?? "" : "";
    if (!name) continue;

    entries.push({
      partNumber:
        colMap.partNumber >= 0 ? cols[colMap.partNumber] || undefined : undefined,
      name,
      quantity:
        colMap.quantity >= 0 ? Number(cols[colMap.quantity]) || 1 : 1,
      referenceDesignator:
        colMap.reference >= 0 ? cols[colMap.reference] || undefined : undefined,
      notes:
        colMap.notes >= 0 ? cols[colMap.notes] || undefined : undefined,
    });
  }

  return entries;
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const idx = headers.findIndex(
      (h) => h === candidate || h.includes(candidate)
    );
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Diff two BOM snapshots.
 * Uses part number for matching when available, falls back to name.
 * Detects: additions, removals, quantity changes, and substitutions.
 */
function diffBom(
  previous: ParsedBomEntry[],
  current: ParsedBomEntry[]
): BomDiffResult {
  const result: BomDiffResult = {
    added: [],
    removed: [],
    quantityChanged: [],
    substituted: [],
    unchanged: [],
  };

  // Build lookup maps
  const prevByKey = new Map<string, ParsedBomEntry>();
  const currByKey = new Map<string, ParsedBomEntry>();

  for (const entry of previous) {
    prevByKey.set(entryKey(entry), entry);
  }
  for (const entry of current) {
    currByKey.set(entryKey(entry), entry);
  }

  const matchedPrevKeys = new Set<string>();

  // Check current entries against previous
  for (const [key, currEntry] of currByKey) {
    const prevEntry = prevByKey.get(key);

    if (prevEntry) {
      matchedPrevKeys.add(key);
      if (prevEntry.quantity !== currEntry.quantity) {
        result.quantityChanged.push({
          entry: currEntry,
          previousQty: prevEntry.quantity,
          newQty: currEntry.quantity,
        });
      } else {
        result.unchanged.push(currEntry);
      }
    } else {
      // New entry — could be an addition or a substitution
      result.added.push(currEntry);
    }
  }

  // Check for removed entries
  for (const [key, prevEntry] of prevByKey) {
    if (!matchedPrevKeys.has(key)) {
      result.removed.push(prevEntry);
    }
  }

  // Detect substitutions: if exactly one was added and one removed at the
  // same reference designator, it's likely a substitution
  if (result.added.length > 0 && result.removed.length > 0) {
    const addedWithRef = result.added.filter((e) => e.referenceDesignator);
    const removedWithRef = result.removed.filter((e) => e.referenceDesignator);

    for (const added of addedWithRef) {
      const matchingRemoved = removedWithRef.find(
        (r) => r.referenceDesignator === added.referenceDesignator
      );
      if (matchingRemoved) {
        result.substituted.push({
          previous: matchingRemoved,
          replacement: added,
        });
        // Remove from added/removed lists
        result.added = result.added.filter((e) => e !== added);
        result.removed = result.removed.filter((e) => e !== matchingRemoved);
      }
    }
  }

  return result;
}

function entryKey(entry: ParsedBomEntry): string {
  // Prefer part number for matching, fall back to normalized name
  if (entry.partNumber) return `pn:${entry.partNumber}`;
  return `name:${entry.name.toLowerCase().replace(/\s+/g, "_")}`;
}

/**
 * Compute a simple hash of BOM entries for quick change detection.
 */
function computeContentHash(entries: ParsedBomEntry[]): string {
  const sorted = [...entries].sort((a, b) =>
    entryKey(a).localeCompare(entryKey(b))
  );
  const str = sorted
    .map(
      (e) =>
        `${e.partNumber ?? ""}|${e.name}|${e.quantity}|${e.referenceDesignator ?? ""}`
    )
    .join("\n");

  // Simple hash — good enough for change detection
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return `bom-${hash.toString(16)}`;
}
