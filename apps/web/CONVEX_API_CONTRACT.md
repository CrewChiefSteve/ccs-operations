# Convex API Contract — Dashboard Requirements

This document specifies every Convex query and mutation the web dashboard calls.
Use this to verify your deployed Convex functions match what the frontend expects.

---

## `convex/dashboard.ts`

### `api.dashboard.getOverview`
**Type:** Query (no args)  
**Returns:**
```typescript
{
  totalComponents: number;
  totalStockValue: number;
  totalInventoryItems: number;
  openAlerts: number;
  criticalAlerts: number;
  pendingTasks: number;
  overdueTasks: number;
  lowStockComponents: Array<{
    _id: string;
    name: string;
    available: number;
    minimum: number;
  }>;
  recentAlerts: Array<{
    _id: string;
    title: string;
    severity: string;
    createdAt: number;
  }>;
  recentTasks: Array<{
    _id: string;
    title: string;
    priority: string;
    category: string;
  }>;
  activePOs: Array<{
    _id: string;
    poNumber: string;
    supplierName: string;
    status: string;
    total: number;
  }>;
  activeBuilds: Array<{
    _id: string;
    buildNumber: string;
    product: string;
    status: string;
    quantity: number;
  }>;
}
```

---

## `convex/inventory/components.ts`

### `api.inventory.components.list`
**Type:** Query  
**Args:**
```typescript
{
  search?: string;
  category?: string;
}
```
**Returns:** `Component[]` — Full component objects sorted by updatedAt desc.

### `api.inventory.components.create`
**Type:** Mutation  
**Args:**
```typescript
{
  partNumber: string;
  name: string;
  category: string;
  subcategory?: string;
  manufacturer?: string;
  manufacturerPN?: string;
  description?: string;
  unitOfMeasure: string;
}
```

---

## `convex/inventory/stock.ts`

### `api.inventory.stock.listWithDetails`
**Type:** Query  
**Args:**
```typescript
{
  search?: string;
  status?: string;
}
```
**Returns:** Array of inventory rows joined with component and location names:
```typescript
Array<{
  _id: string;
  componentId: string;
  componentName: string;
  partNumber: string;
  locationName: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  status: string;
  costPerUnit?: number;
  lastCountedAt?: number;
  updatedAt: number;
}>
```

### `api.inventory.stock.adjust`
**Type:** Mutation  
**Args:**
```typescript
{
  inventoryId: string;
  newQuantity: number;
  reason: string;
}
```

---

## `convex/inventory/suppliers.ts`

### `api.inventory.suppliers.list`
**Type:** Query  
**Args:**
```typescript
{
  search?: string;
}
```
**Returns:** `Supplier[]` — optionally with a `componentCount` field.

### `api.inventory.suppliers.create`
**Type:** Mutation  
**Args:**
```typescript
{
  name: string;
  website?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  accountNumber?: string;
  notes?: string;
  rating?: number;
}
```

---

## `convex/inventory/purchaseOrders.ts`

### `api.inventory.purchaseOrders.list`
**Type:** Query  
**Args:**
```typescript
{
  search?: string;
  status?: string;
}
```
**Returns:** PO objects with joined supplier name and line items:
```typescript
Array<{
  _id: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  status: string;
  orderDate?: number;
  expectedDelivery?: number;
  actualDelivery?: number;
  trackingNumber?: string;
  subtotal: number;
  shipping?: number;
  tax?: number;
  total: number;
  notes?: string;
  createdBy: string;
  createdAt: number;
  lineItems?: Array<{
    componentName: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    quantityReceived: number;
  }>;
}>
```

### `api.inventory.purchaseOrders.create`
**Type:** Mutation  
**Args:**
```typescript
{
  poNumber: string;
  supplierId: string;
  notes?: string;
}
```

### `api.inventory.purchaseOrders.updateStatus`
**Type:** Mutation  
**Args:**
```typescript
{
  purchaseOrderId: string;
  status: string;
}
```

---

## `convex/inventory/buildOrders.ts`

### `api.inventory.buildOrders.list`
**Type:** Query  
**Args:**
```typescript
{
  search?: string;
  status?: string;
  product?: string;
}
```
**Returns:** `BuildOrder[]`

### `api.inventory.buildOrders.create`
**Type:** Mutation  
**Args:**
```typescript
{
  buildNumber: string;
  product: string;
  quantity: number;
  bomVersion: string;
  notes?: string;
}
```

### `api.inventory.buildOrders.updateStatus`
**Type:** Mutation  
**Args:**
```typescript
{
  buildOrderId: string;
  status: string;
}
```

---

## `convex/agent/tasks.ts`

### `api.agent.tasks.list`
**Type:** Query  
**Args:**
```typescript
{
  status?: string;
  category?: string;
}
```
**Returns:** `Task[]` — sorted by priority desc, createdAt desc.

### `api.agent.tasks.create`
**Type:** Mutation  
**Args:**
```typescript
{
  title: string;
  description: string;
  priority: string;
  category: string;
  assignedTo?: string;
}
```

### `api.agent.tasks.updateStatus`
**Type:** Mutation  
**Args:**
```typescript
{
  taskId: string;
  status: string;
}
```

### `api.agent.tasks.complete`
**Type:** Mutation  
**Args:**
```typescript
{
  taskId: string;
  completionNotes?: string;
}
```

---

## `convex/agent/alerts.ts`

### `api.agent.alerts.list`
**Type:** Query  
**Args:**
```typescript
{
  status?: string;
  severity?: string;
}
```
**Returns:** `Alert[]` — sorted by severity (critical first), then createdAt desc.

### `api.agent.alerts.acknowledge`
**Type:** Mutation  
**Args:**
```typescript
{
  alertId: string;
}
```

### `api.agent.alerts.resolve`
**Type:** Mutation  
**Args:**
```typescript
{
  alertId: string;
  resolvedBy: string;
}
```

### `api.agent.alerts.dismiss`
**Type:** Mutation  
**Args:**
```typescript
{
  alertId: string;
}
```

---

## Notes

- All queries use Convex's reactive `useQuery` hook — the UI updates in real-time
- Queries that accept `search` should ideally use Convex search indexes for full-text search
- The dashboard `getOverview` query aggregates data from multiple tables — implement as a single query for efficiency
- Status mutations should validate transitions (e.g., can't go from "received" back to "draft")
- All inventory changes should create `inventoryTransactions` entries for the audit trail
