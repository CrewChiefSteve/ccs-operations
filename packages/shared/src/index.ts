// ============================================================
// CCS Operations — Shared Types & Constants
// ============================================================

// Product names matching Google Drive structure
export const CCS_PRODUCTS = [
  "Oil_Heater_Controller",
  "RaceScale",
  "Ride_Height_Sensor",
  "Tire_Temperature",
  "Tire-Temp-Probe",
] as const;

export type CCSProduct = typeof CCS_PRODUCTS[number];

// Drive folder types per CLAUDE.md
export const DRIVE_FOLDER_TYPES = [
  "BOM",
  "Datasheets",
  "Firmware",
  "Hardware",
  "Production",
  "Testing",
] as const;

export type DriveFolderType = typeof DRIVE_FOLDER_TYPES[number];

// Component categories
export const COMPONENT_CATEGORIES = [
  "microcontroller",
  "sensor",
  "passive",
  "connector",
  "mechanical",
  "pcb",
  "enclosure",
  "power",
  "display",
  "communication",
  "other",
] as const;

export type ComponentCategory = typeof COMPONENT_CATEGORIES[number];

// Status enums
export const COMPONENT_STATUSES = ["active", "deprecated", "eol", "pending_review"] as const;
export const SUPPLIER_STATUSES = ["active", "inactive", "preferred"] as const;
export const INVENTORY_STATUSES = ["in_stock", "low_stock", "out_of_stock", "overstock"] as const;
export const PO_STATUSES = ["draft", "submitted", "confirmed", "shipped", "partial_received", "received", "cancelled"] as const;
export const BUILD_STATUSES = ["planned", "materials_reserved", "in_progress", "qc", "complete", "cancelled"] as const;
export const TASK_STATUSES = ["pending", "assigned", "in_progress", "completed", "verified", "cancelled", "escalated"] as const;
export const ALERT_SEVERITIES = ["info", "warning", "critical"] as const;
export const ALERT_TYPES = ["low_stock", "out_of_stock", "po_overdue", "qc_failure", "structure_violation", "bom_change", "count_discrepancy", "task_overdue"] as const;
export const TASK_TYPES = ["count_inventory", "receive_shipment", "move_stock", "quality_check", "file_document", "review_bom", "general"] as const;
export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export type Priority = typeof PRIORITIES[number];

// Phase 5: User roles
export const USER_ROLES = ["admin", "operator"] as const;
export type UserRole = typeof USER_ROLES[number];

// Phase 5: Supplier API providers
export const SUPPLIER_PROVIDERS = ["digikey", "mouser", "lcsc", "manual"] as const;
export type SupplierProvider = typeof SUPPLIER_PROVIDERS[number];

// Phase 5: Cost types
export const COST_TYPES = ["estimate", "actual"] as const;
export type CostType = typeof COST_TYPES[number];
