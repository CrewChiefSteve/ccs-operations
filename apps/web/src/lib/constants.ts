// CCS Products
export const PRODUCTS = [
  "Oil_Heater_Controller",
  "RaceScale",
  "Ride_Height_Sensor",
  "Tire_Temperature",
  "Tire-Temp-Probe",
] as const;

export type Product = (typeof PRODUCTS)[number];

export const PRODUCT_LABELS: Record<string, string> = {
  Oil_Heater_Controller: "Oil Heater Controller",
  RaceScale: "RaceScale",
  Ride_Height_Sensor: "Ride Height Sensor",
  Tire_Temperature: "Tire Temperature",
  "Tire-Temp-Probe": "Tire Temp Probe",
};

// Component categories
export const COMPONENT_CATEGORIES = [
  "mcu",
  "sensor",
  "passive",
  "connector",
  "pcb",
  "mechanical",
  "consumable",
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  mcu: "MCU",
  sensor: "Sensor",
  passive: "Passive",
  connector: "Connector",
  pcb: "PCB",
  mechanical: "Mechanical",
  consumable: "Consumable",
};

// Status colors and labels
export const PO_STATUS_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  draft: { label: "Draft", color: "bg-surface-3 text-text-secondary" },
  submitted: { label: "Submitted", color: "bg-blue-500/15 text-blue-400" },
  confirmed: { label: "Confirmed", color: "bg-indigo-500/15 text-indigo-400" },
  shipped: { label: "Shipped", color: "bg-amber-500/15 text-amber-400" },
  partial_received: { label: "Partial Received", color: "bg-orange-500/15 text-orange-400" },
  received: { label: "Received", color: "bg-emerald-500/15 text-emerald-400" },
  cancelled: { label: "Cancelled", color: "bg-red-500/15 text-red-400" },
};

export const BUILD_STATUS_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  planned: { label: "Planned", color: "bg-surface-3 text-text-secondary" },
  materials_reserved: {
    label: "Materials Reserved",
    color: "bg-blue-500/15 text-blue-400",
  },
  in_progress: {
    label: "In Progress",
    color: "bg-amber-500/15 text-amber-400",
  },
  qc: { label: "QC", color: "bg-purple-500/15 text-purple-400" },
  complete: { label: "Complete", color: "bg-emerald-500/15 text-emerald-400" },
  cancelled: { label: "Cancelled", color: "bg-red-500/15 text-red-400" },
};

export const ALERT_SEVERITY_CONFIG: Record<
  string,
  { label: string; color: string; dot: string }
> = {
  info: {
    label: "Info",
    color: "bg-blue-500/15 text-blue-400",
    dot: "bg-blue-400",
  },
  warning: {
    label: "Warning",
    color: "bg-amber-500/15 text-amber-400",
    dot: "bg-amber-400",
  },
  critical: {
    label: "Critical",
    color: "bg-red-500/15 text-red-400",
    dot: "bg-red-400",
  },
};

export const TASK_PRIORITY_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  low: { label: "Low", color: "bg-surface-3 text-text-secondary" },
  normal: { label: "Normal", color: "bg-blue-500/15 text-blue-400" },
  high: { label: "High", color: "bg-amber-500/15 text-amber-400" },
  urgent: { label: "Urgent", color: "bg-red-500/15 text-red-400" },
};

export const TASK_STATUS_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  pending: { label: "Pending", color: "bg-amber-500/15 text-amber-400" },
  assigned: { label: "Assigned", color: "bg-blue-500/15 text-blue-400" },
  in_progress: { label: "In Progress", color: "bg-blue-500/15 text-blue-400" },
  completed: { label: "Completed", color: "bg-emerald-500/15 text-emerald-400" },
  verified: { label: "Verified", color: "bg-emerald-500/15 text-emerald-400" },
  escalated: { label: "Escalated", color: "bg-red-500/15 text-red-400" },
  cancelled: { label: "Cancelled", color: "bg-surface-3 text-text-secondary" },
};

export const INVENTORY_STATUS_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  available: {
    label: "Available",
    color: "bg-emerald-500/15 text-emerald-400",
  },
  reserved: { label: "Reserved", color: "bg-blue-500/15 text-blue-400" },
  quarantine: {
    label: "Quarantine",
    color: "bg-amber-500/15 text-amber-400",
  },
  damaged: { label: "Damaged", color: "bg-red-500/15 text-red-400" },
};

// Phase 5: User roles
export const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  admin: { label: "Admin", color: "bg-accent/15 text-accent" },
  operator: { label: "Operator", color: "bg-blue-500/15 text-blue-400" },
};

// Phase 5: Supplier API providers
export const SUPPLIER_PROVIDER_LABELS: Record<string, string> = {
  digikey: "DigiKey",
  mouser: "Mouser",
  lcsc: "LCSC",
  manual: "Manual",
};

export const SUPPLIER_PROVIDER_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  digikey: { label: "DigiKey", color: "bg-red-500/15 text-red-400" },
  mouser: { label: "Mouser", color: "bg-blue-500/15 text-blue-400" },
  lcsc: { label: "LCSC", color: "bg-emerald-500/15 text-emerald-400" },
  manual: { label: "Manual", color: "bg-surface-3 text-text-secondary" },
};
