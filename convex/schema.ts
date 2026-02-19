import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ============================================================
// CCS Technologies — Operational Platform Schema
// ============================================================
// Phase 2: Core inventory tables + agent infrastructure
// All tables use Convex auto-generated _id and _creationTime
// ============================================================

export default defineSchema({
  // ----------------------------------------------------------
  // COMPONENT CATALOG
  // ----------------------------------------------------------
  components: defineTable({
    partNumber: v.string(),        // CCS internal part number (e.g., "CCS-ESP32-C3-001")
    name: v.string(),              // Human-readable name
    description: v.optional(v.string()),
    category: v.string(),          // "microcontroller", "sensor", "passive", "connector", "mechanical", "pcb", "enclosure"
    subcategory: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    manufacturerPartNumber: v.optional(v.string()),
    unitOfMeasure: v.optional(v.string()), // "each", "meter", "gram", "ml", "ft", "roll"
    specs: v.optional(v.object({
      package: v.optional(v.string()),
      value: v.optional(v.string()),     // "10kΩ", "100nF", etc.
      voltage: v.optional(v.string()),
      current: v.optional(v.string()),
      tolerance: v.optional(v.string()),
      temperature: v.optional(v.string()),
      custom: v.optional(v.any()),       // Freeform specs
    })),
    datasheetUrl: v.optional(v.string()),       // External URL
    datasheetDriveFileId: v.optional(v.string()), // Google Drive file ID
    imageUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.string(),            // "active", "deprecated", "eol", "pending_review"
    usedInProducts: v.optional(v.array(v.string())), // ["Oil_Heater_Controller", "RaceScale"]
    createdBy: v.optional(v.string()),
    updatedAt: v.number(),         // Timestamp for manual tracking
  })
    .index("by_partNumber", ["partNumber"])
    .index("by_category", ["category"])
    .index("by_status", ["status"])
    .index("by_manufacturer", ["manufacturer"])
    .searchIndex("search_components", {
      searchField: "name",
      filterFields: ["category", "status"],
    }),

  // ----------------------------------------------------------
  // SUPPLIERS
  // ----------------------------------------------------------
  suppliers: defineTable({
    name: v.string(),              // "DigiKey", "Mouser", "JLCPCB", "Amazon", "Direct"
    code: v.string(),              // Short code: "DK", "MOU", "JLC"
    website: v.optional(v.string()),
    accountNumber: v.optional(v.string()),
    contactName: v.optional(v.string()),  // Primary contact name
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    notes: v.optional(v.string()),
    rating: v.optional(v.number()),       // 1-5 supplier rating
    leadTimeDays: v.optional(v.number()), // Typical lead time
    shippingNotes: v.optional(v.string()),
    status: v.string(),            // "active", "inactive", "preferred"
    updatedAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_status", ["status"])
    .searchIndex("search_suppliers", {
      searchField: "name",
      filterFields: ["status"],
    }),

  // ----------------------------------------------------------
  // COMPONENT ↔ SUPPLIER JUNCTION (pricing/availability)
  // ----------------------------------------------------------
  componentSuppliers: defineTable({
    componentId: v.id("components"),
    supplierId: v.id("suppliers"),
    supplierPartNumber: v.optional(v.string()),
    unitPrice: v.optional(v.number()),
    currency: v.optional(v.string()),     // Default "USD"
    minOrderQty: v.optional(v.number()),
    leadTimeDays: v.optional(v.number()),
    url: v.optional(v.string()),          // Direct product page link
    lastPriceCheck: v.optional(v.number()),
    inStock: v.optional(v.boolean()),
    notes: v.optional(v.string()),
    isPreferred: v.boolean(),      // Preferred supplier for this component
    updatedAt: v.number(),
  })
    .index("by_component", ["componentId"])
    .index("by_supplier", ["supplierId"])
    .index("by_component_supplier", ["componentId", "supplierId"]),

  // ----------------------------------------------------------
  // WAREHOUSE LOCATIONS (hierarchical)
  // ----------------------------------------------------------
  locations: defineTable({
    name: v.string(),              // "Shelf A", "Bin 3", "SMD Drawer 2"
    code: v.string(),              // "WH1-SA-B3" — unique location code
    type: v.string(),              // "room", "shelf", "bin", "drawer", "zone"
    parentId: v.optional(v.id("locations")),
    description: v.optional(v.string()),
    capacity: v.optional(v.number()),
    status: v.string(),            // "active", "full", "inactive"
    updatedAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_parent", ["parentId"])
    .index("by_type", ["type"]),

  // ----------------------------------------------------------
  // INVENTORY (stock per component per location)
  // ----------------------------------------------------------
  inventory: defineTable({
    componentId: v.id("components"),
    locationId: v.id("locations"),
    quantity: v.number(),          // Current stock count
    reservedQty: v.number(),       // Reserved for build orders
    availableQty: v.number(),      // quantity - reservedQty
    minimumStock: v.optional(v.number()),  // Reorder threshold
    maximumStock: v.optional(v.number()),
    costPerUnit: v.optional(v.number()),   // Unit cost for value calculations
    lastCountedAt: v.optional(v.number()),
    lastCountedBy: v.optional(v.string()),
    status: v.string(),            // "in_stock", "low_stock", "out_of_stock", "overstock"
    updatedAt: v.number(),
  })
    .index("by_component", ["componentId"])
    .index("by_location", ["locationId"])
    .index("by_component_location", ["componentId", "locationId"])
    .index("by_status", ["status"]),

  // ----------------------------------------------------------
  // BOM ENTRIES (component → product mapping)
  // ----------------------------------------------------------
  bomEntries: defineTable({
    productName: v.string(),       // "Oil_Heater_Controller", "RaceScale", etc.
    componentId: v.id("components"),
    quantityPerUnit: v.number(),   // How many per single product build
    referenceDesignator: v.optional(v.string()), // "R1", "C3", "U2"
    placement: v.optional(v.string()),  // "SMD", "through-hole", "mechanical"
    isOptional: v.boolean(),
    substituteComponentIds: v.optional(v.array(v.id("components"))),
    notes: v.optional(v.string()),
    bomVersion: v.optional(v.string()),  // "1.0", "1.1"
    driveFileId: v.optional(v.string()), // Google Drive BOM document ID
    updatedAt: v.number(),
  })
    .index("by_product", ["productName"])
    .index("by_component", ["componentId"])
    .index("by_product_component", ["productName", "componentId"]),

  // ----------------------------------------------------------
  // PURCHASE ORDERS
  // ----------------------------------------------------------
  purchaseOrders: defineTable({
    poNumber: v.string(),          // "PO-2026-001"
    supplierId: v.id("suppliers"),
    status: v.string(),            // "draft", "submitted", "confirmed", "shipped", "partial_received", "received", "cancelled"
    orderDate: v.optional(v.number()),
    expectedDelivery: v.optional(v.number()),
    actualDelivery: v.optional(v.number()),
    trackingNumber: v.optional(v.string()),
    trackingUrl: v.optional(v.string()),
    subtotal: v.optional(v.number()),
    shippingCost: v.optional(v.number()),
    taxAmount: v.optional(v.number()),
    totalCost: v.optional(v.number()),
    notes: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    approvedBy: v.optional(v.string()),
    approvedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_poNumber", ["poNumber"])
    .index("by_supplier", ["supplierId"])
    .index("by_status", ["status"])
    .index("by_orderDate", ["orderDate"]),

  // ----------------------------------------------------------
  // PURCHASE ORDER LINES
  // ----------------------------------------------------------
  purchaseOrderLines: defineTable({
    purchaseOrderId: v.id("purchaseOrders"),
    componentId: v.id("components"),
    quantityOrdered: v.number(),
    quantityReceived: v.number(),  // Updated as items arrive
    unitPrice: v.number(),
    lineTotal: v.number(),
    status: v.string(),            // "pending", "partial", "received", "cancelled", "backordered"
    notes: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_purchaseOrder", ["purchaseOrderId"])
    .index("by_component", ["componentId"])
    .index("by_status", ["status"]),

  // ----------------------------------------------------------
  // BUILD ORDERS (production tracking)
  // ----------------------------------------------------------
  buildOrders: defineTable({
    buildNumber: v.string(),       // "BUILD-OH-2026-001"
    productName: v.string(),       // "Oil_Heater_Controller"
    quantity: v.number(),          // Units to build
    status: v.string(),            // "planned", "materials_reserved", "in_progress", "qc", "complete", "cancelled"
    priority: v.string(),          // "low", "normal", "high", "urgent"
    scheduledStart: v.optional(v.number()),
    actualStart: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    bomVersion: v.optional(v.string()),
    assignedTo: v.optional(v.string()),
    qcStatus: v.optional(v.string()),    // "pending", "passed", "failed", "rework"
    qcNotes: v.optional(v.string()),
    qcPassedCount: v.optional(v.number()),
    qcFailedCount: v.optional(v.number()),
    driveProductionDocId: v.optional(v.string()), // Link to Drive production docs
    notes: v.optional(v.string()),
    createdBy: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_buildNumber", ["buildNumber"])
    .index("by_product", ["productName"])
    .index("by_status", ["status"])
    .index("by_priority", ["priority"]),

  // ----------------------------------------------------------
  // INVENTORY TRANSACTIONS (append-only audit trail)
  // ----------------------------------------------------------
  inventoryTransactions: defineTable({
    type: v.string(),              // "receive", "consume", "adjust", "transfer", "scrap", "return", "reserve", "unreserve"
    componentId: v.id("components"),
    locationId: v.id("locations"),
    quantity: v.number(),          // Positive = add, negative = remove
    previousQty: v.number(),       // Snapshot before change
    newQty: v.number(),            // Snapshot after change
    // Reference linking
    referenceType: v.optional(v.string()),  // "purchase_order", "build_order", "manual", "cycle_count"
    referenceId: v.optional(v.string()),    // ID of the PO, build order, etc.
    // Transfer-specific
    toLocationId: v.optional(v.id("locations")),
    // Metadata
    performedBy: v.optional(v.string()),
    verifiedBy: v.optional(v.string()),
    reason: v.optional(v.string()),
    notes: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_component", ["componentId"])
    .index("by_location", ["locationId"])
    .index("by_type", ["type"])
    .index("by_timestamp", ["timestamp"])
    .index("by_reference", ["referenceType", "referenceId"]),

  // ----------------------------------------------------------
  // AGENT: ALERTS
  // ----------------------------------------------------------
  alerts: defineTable({
    type: v.string(),              // "low_stock", "out_of_stock", "po_overdue", "qc_failure", "structure_violation", "bom_change", "count_discrepancy"
    severity: v.string(),          // "info", "warning", "critical"
    title: v.string(),
    message: v.string(),
    // Context linking
    componentId: v.optional(v.id("components")),
    purchaseOrderId: v.optional(v.id("purchaseOrders")),
    buildOrderId: v.optional(v.id("buildOrders")),
    locationId: v.optional(v.id("locations")),
    driveFileId: v.optional(v.string()),
    // Lifecycle
    status: v.string(),            // "active", "acknowledged", "resolved", "dismissed"
    acknowledgedBy: v.optional(v.string()),
    acknowledgedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    resolvedAction: v.optional(v.string()),
    // Agent metadata
    agentGenerated: v.boolean(),
    agentContext: v.optional(v.string()), // JSON blob of agent reasoning
    updatedAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_severity", ["severity"])
    .index("by_status", ["status"])
    .index("by_component", ["componentId"])
    .index("by_type_status", ["type", "status"]),

  // ----------------------------------------------------------
  // AGENT: TASKS (Meat Bag Director)
  // ----------------------------------------------------------
  tasks: defineTable({
    title: v.string(),
    description: v.string(),       // Specific, actionable instructions
    type: v.string(),              // "count_inventory", "receive_shipment", "move_stock", "quality_check", "file_document", "review_bom", "general"
    priority: v.string(),          // "low", "normal", "high", "urgent"
    status: v.string(),            // "pending", "assigned", "in_progress", "completed", "verified", "cancelled", "escalated"
    assignedTo: v.optional(v.string()),
    // SLA tracking
    dueAt: v.optional(v.number()),
    slaHours: v.optional(v.number()),    // Hours before escalation
    escalatedAt: v.optional(v.number()),
    escalationLevel: v.number(),          // 0 = normal, 1 = priority bump, 2 = notify other founder
    // Context
    componentId: v.optional(v.id("components")),
    locationId: v.optional(v.id("locations")),
    purchaseOrderId: v.optional(v.id("purchaseOrders")),
    buildOrderId: v.optional(v.id("buildOrders")),
    alertId: v.optional(v.id("alerts")),
    // Completion
    completedAt: v.optional(v.number()),
    completedBy: v.optional(v.string()),
    completionNotes: v.optional(v.string()),
    verifiedAt: v.optional(v.number()),
    verifiedBy: v.optional(v.string()),
    // Agent metadata
    agentGenerated: v.boolean(),
    agentContext: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_priority", ["priority"])
    .index("by_assignedTo", ["assignedTo"])
    .index("by_type", ["type"])
    .index("by_dueAt", ["dueAt"]),

  // ----------------------------------------------------------
  // DRIVE SYNC: FILE INDEX
  // ----------------------------------------------------------
  driveFiles: defineTable({
    driveFileId: v.string(),       // Google Drive file ID
    name: v.string(),
    mimeType: v.string(),
    parentDriveId: v.optional(v.string()),
    path: v.string(),              // Full path: "Products/Oil_Heater_Controller/BOM/bom-v1.2.xlsx"
    productName: v.optional(v.string()),  // Extracted from path
    folderType: v.optional(v.string()),   // "BOM", "Datasheets", "Firmware", etc.
    size: v.optional(v.number()),
    modifiedTime: v.optional(v.number()),
    modifiedBy: v.optional(v.string()),
    webViewLink: v.optional(v.string()),
    lastSyncedAt: v.number(),
    status: v.string(),            // "active", "deleted", "moved"
  })
    .index("by_driveFileId", ["driveFileId"])
    .index("by_path", ["path"])
    .index("by_product", ["productName"])
    .index("by_folderType", ["folderType"])
    .index("by_lastSyncedAt", ["lastSyncedAt"])
    .searchIndex("search_driveFiles", {
      searchField: "name",
      filterFields: ["productName", "folderType"],
    }),

  // ----------------------------------------------------------
  // DRIVE SYNC: AUDIT LOG
  // ----------------------------------------------------------
  driveSyncLog: defineTable({
    syncType: v.string(),          // "full", "incremental", "manual"
    status: v.string(),            // "started", "completed", "failed"
    filesProcessed: v.optional(v.number()),
    filesAdded: v.optional(v.number()),
    filesUpdated: v.optional(v.number()),
    filesDeleted: v.optional(v.number()),
    errors: v.optional(v.array(v.string())),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    triggeredBy: v.optional(v.string()), // "cron", "manual", "webhook"
  })
    .index("by_status", ["status"])
    .index("by_startedAt", ["startedAt"]),

  // ----------------------------------------------------------
  // RECEIPT PHOTOS (PO receiving workflow)
  // ----------------------------------------------------------
  receiptPhotos: defineTable({
    purchaseOrderId: v.id("purchaseOrders"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    uploadedBy: v.string(),
    uploadedAt: v.number(),
  })
    .index("by_purchaseOrder", ["purchaseOrderId"]),

  // ----------------------------------------------------------
  // PHASE 4: BOM CHANGE TRACKING
  // ----------------------------------------------------------
  bomChangeLogs: defineTable({
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
    taskId: v.optional(v.id("tasks")),
    alertId: v.optional(v.id("alerts")),
    inventoryImpact: v.optional(v.object({
      componentId: v.optional(v.id("components")),
      currentStock: v.optional(v.number()),
      requiredPerUnit: v.optional(v.number()),
      shortfall: v.optional(v.number()),
      estimatedCost: v.optional(v.number()),
    })),
    detectedAt: v.number(),
    resolvedAt: v.optional(v.number()),
    processedBy: v.optional(v.string()),
  })
    .index("by_product", ["product"])
    .index("by_status", ["status"])
    .index("by_detectedAt", ["detectedAt"])
    .index("by_driveFileId", ["driveFileId"])
    .index("by_product_status", ["product", "status"]),

  // ----------------------------------------------------------
  // PHASE 4: DAILY BRIEFINGS
  // ----------------------------------------------------------
  briefings: defineTable({
    date: v.string(),
    generatedAt: v.number(),
    summary: v.string(),
    sections: v.object({
      inventory: v.object({
        lowStockCount: v.number(),
        pendingPOs: v.number(),
        arrivingToday: v.number(),
        activeBuildOrders: v.number(),
        highlights: v.array(v.string()),
      }),
      drive: v.object({
        filesModifiedYesterday: v.number(),
        structuralViolations: v.number(),
        staleEngLogs: v.number(),
        highlights: v.array(v.string()),
      }),
      tasks: v.object({
        pendingCount: v.number(),
        overdueCount: v.number(),
        completedYesterday: v.number(),
        highlights: v.array(v.string()),
      }),
      upcoming: v.object({
        highlights: v.array(v.string()),
      }),
    }),
    dataSnapshot: v.optional(v.string()),
    status: v.union(
      v.literal("generating"),
      v.literal("ready"),
      v.literal("error")
    ),
    error: v.optional(v.string()),
    readBy: v.optional(v.array(v.string())),
  })
    .index("by_date", ["date"])
    .index("by_generatedAt", ["generatedAt"]),

  // ----------------------------------------------------------
  // PUSH TOKENS (Expo Push Notifications)
  // ----------------------------------------------------------
  pushTokens: defineTable({
    token: v.string(),                    // Expo Push Token (ExponentPushToken[xxx])
    userId: v.string(),                   // Clerk user ID or email
    deviceName: v.optional(v.string()),
    platform: v.string(),                 // "ios" | "android"
    isActive: v.boolean(),
    registeredAt: v.number(),
    lastUsedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_token", ["token"])
    .index("by_isActive", ["isActive"]),

  // ----------------------------------------------------------
  // PHASE 4: BOM SNAPSHOTS (for change diffing)
  // ----------------------------------------------------------
  bomSnapshots: defineTable({
    product: v.string(),
    bomVersion: v.optional(v.string()),
    driveFileId: v.optional(v.id("driveFiles")),
    driveId: v.optional(v.string()),
    entries: v.array(v.object({
      partNumber: v.optional(v.string()),
      name: v.string(),
      quantity: v.number(),
      referenceDesignator: v.optional(v.string()),
      notes: v.optional(v.string()),
    })),
    contentHash: v.string(),
    snapshotAt: v.number(),
  })
    .index("by_product", ["product"])
    .index("by_product_version", ["product", "bomVersion"])
    .index("by_driveId", ["driveId"]),
});
