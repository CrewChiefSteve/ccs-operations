# CCS Operations Platform

## What This Is
Internal operations platform for CCS Technologies. Manages inventory, warehouse, purchasing, build orders, and Google Drive engineering docs. Completely separate from the customer-facing crewchiefsteve.ai.

## Architecture
- **Convex** backend with 14 tables (see `convex/schema.ts`)
- **MCP servers** in `packages/` for Claude Code/Chat integration
- **Next.js** web dashboard in `apps/web/`
- **React Native/Expo** mobile app in `apps/mobile/`

## Convex Backend Layout

```
convex/
├── schema.ts                    # All 14 tables with validators and indexes
├── dashboard.ts                 # Aggregate overview query
├── inventory/
│   ├── components.ts            # Part catalog CRUD
│   ├── suppliers.ts             # Vendor directory CRUD
│   ├── componentSuppliers.ts    # Component↔Supplier pricing junction
│   ├── locations.ts             # Hierarchical warehouse locations
│   ├── stock.ts                 # Inventory stock levels, reserve/release/count
│   ├── bomEntries.ts            # BOM management + feasibility checker
│   ├── purchaseOrders.ts        # PO lifecycle + line items + receiving
│   ├── buildOrders.ts           # Build order lifecycle
│   └── transactions.ts          # Append-only inventory audit trail
├── agent/
│   ├── alerts.ts                # Agent-generated alerts with lifecycle
│   └── tasks.ts                 # Meat Bag Director task system with SLA/escalation
└── driveSync/
    ├── driveFiles.ts            # Google Drive metadata index
    └── syncLog.ts               # Drive sync audit trail
```

## Products (matching Google Drive structure)
- Oil_Heater_Controller
- RaceScale
- Ride_Height_Sensor
- Tire_Temperature
- Tire-Temp-Probe
- Shared: Products/Shared_Components/ (BLE_Protocol, Common_Libraries, Datasheets, ESP32_C3)

## Key Patterns
- **Mutations** validate inputs, check for duplicates, enforce referential integrity
- **Status transitions** use explicit allowlists (POs, build orders)
- **Deletion** is guarded — can't delete components with inventory or BOM refs
- **Stock management** tracks quantity, reserved, and available separately
- **Transactions** are append-only with before/after snapshots
- **Tasks** have SLA tracking with auto-escalation (24hr → priority bump, 48hr → notify other founder)
- **Enriched queries** join component/supplier/location names for dashboard display

## Conventions
- All timestamps are `Date.now()` (milliseconds since epoch)
- All tables have `updatedAt` for optimistic concurrency tracking
- IDs use Convex's built-in `v.id("tableName")` references
- Part numbers follow: `CCS-{TYPE}-{DETAIL}-{SEQ}` (e.g., `CCS-ESP32-C3-001`)
- PO numbers: `PO-{YEAR}-{SEQ}` (e.g., `PO-2026-001`)
- Build numbers: `BUILD-{PRODUCT_CODE}-{YEAR}-{SEQ}` (e.g., `BUILD-OH-2026-001`)

## Phase Status
- ✅ Phase 1: Google Drive MCP Server (in `packages/drive-mcp/`)
- ✅ Phase 2: Convex schema + backend mutations/queries
- 🔲 Phase 3: Inventory agent + transaction workflows
- 🔲 Phase 4: Cross-system intelligence + inventory-mcp
