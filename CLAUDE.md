# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is
Internal operations platform for CCS Technologies. Manages inventory, warehouse, purchasing, build orders, and Google Drive engineering docs. Completely separate from the customer-facing crewchiefsteve.ai.

## Architecture
- **Convex** backend with 17 tables (see `convex/schema.ts`)
- **MCP servers** in `packages/` for Claude Code/Chat integration
- **Next.js 15** web dashboard in `apps/web/` (React 19, Tailwind, Clerk auth)
- **pnpm workspaces** monorepo — packages: `apps/web`, `packages/shared`

## Commands

Run both servers simultaneously during development:
```bash
pnpm dev:convex     # Convex dev watcher (must run alongside web)
pnpm dev            # Next.js dev server (apps/web)
pnpm build          # Production build
pnpm lint           # Lint all packages
pnpm typecheck      # TypeScript check all packages
npx convex deploy --yes   # Deploy to prod (hip-rabbit-748.convex.cloud)
```

Convex deployments:
- **Dev**: `rugged-heron-983.convex.cloud` (set via `CONVEX_DEPLOYMENT` in `.env.local`)
- **Prod**: `hip-rabbit-748.convex.cloud`

## Auth
Clerk + Convex via `ConvexProviderWithClerk`. Provider wraps the whole app in `apps/web/src/lib/providers.tsx`. Convex auth config is at `convex/auth.config.ts` (domain: `clerk.crewchiefsteve.ai`). The `.env.local` needs `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.

## Convex Backend Layout

```
convex/
├── schema.ts                    # All 14 tables with validators and indexes
├── auth.config.ts               # Clerk provider config
├── dashboard.ts                 # Aggregate overview query
├── crons.ts                     # Scheduled jobs (stock monitor, PO overdue, task SLA, BOM scan, daily briefing)
├── inventory/
│   ├── components.ts            # Part catalog CRUD
│   ├── suppliers.ts             # Vendor directory CRUD
│   ├── componentSuppliers.ts    # Component↔Supplier pricing junction
│   ├── locations.ts             # Hierarchical warehouse locations
│   ├── stock.ts                 # Inventory stock levels, reserve/release/count
│   ├── bomEntries.ts            # BOM management + feasibility checker
│   ├── purchaseOrders.ts        # PO lifecycle + line items + receiving
│   ├── buildOrders.ts           # Build order lifecycle
│   ├── buildWorkflow.ts         # Material reservation, consumption, release + BOM feasibility
│   ├── transactions.ts          # Append-only inventory audit trail
│   ├── stockmonitor.ts          # Internal mutations: stock threshold + overdue PO checks
│   └── receiving.ts             # Full receive-from-PO workflow (PO→txn→stock→alerts)
├── agent/
│   ├── alerts.ts                # Agent-generated alerts with lifecycle
│   ├── tasks.ts                 # Meat Bag Director task system with SLA/escalation
│   ├── taskEscalation.ts        # Internal mutation: SLA monitor + escalation cron
│   ├── bomSync.ts               # BOM change detection, diff, inventory reconciliation (Phase 4A)
│   └── briefing.ts              # Daily briefing generator via Claude API (Phase 4A)
└── driveSync/
    ├── driveFiles.ts            # Google Drive metadata index
    └── syncLog.ts               # Drive sync audit trail
```

## Web App Routes (apps/web)

| Route | Purpose |
|---|---|
| `/dashboard` | Aggregate overview (`convex/dashboard.ts`) |
| `/catalog` | Component catalog |
| `/inventory` | Stock levels |
| `/suppliers` | Supplier directory |
| `/orders` | Purchase orders |
| `/receiving` | PO receiving workflow |
| `/builds` | Build orders |
| `/tasks` | Agent task queue |
| `/alerts` | Agent alerts |

UI components live in `apps/web/src/components/ui/`. Status badge colors and label configs are in `apps/web/src/lib/constants.ts`.

## Tailwind Design Tokens
Custom tokens used throughout (defined in Tailwind config):
- Surfaces: `surface-1`, `surface-3`, `surface-4`
- Text: `text-primary`, `text-secondary`, `text-tertiary`
- Accent: `accent` (CCS orange `#e85d26`)
- Font size: `text-2xs`

## Shared Package
`packages/shared/src/index.ts` exports canonical enums: `CCS_PRODUCTS`, `COMPONENT_CATEGORIES`, status arrays for all entities, and their TypeScript types. Use these as the source of truth — `apps/web/src/lib/constants.ts` is the web-local copy (with display labels/colors).

## Products (matching Google Drive structure)
- Oil_Heater_Controller
- RaceScale
- Ride_Height_Sensor
- Tire_Temperature
- Tire-Temp-Probe
- Shared: `Products/Shared_Components/` (BLE_Protocol, Common_Libraries, Datasheets, ESP32_C3)

## Key Patterns
- **Mutations** validate inputs, check for duplicates, enforce referential integrity
- **Status transitions** use explicit allowlists (POs, build orders)
- **Deletion** is guarded — can't delete components with inventory or BOM refs
- **Stock management** tracks `quantity`, `reservedQty`, and `availableQty` separately
- **Transactions** are append-only with before/after snapshots
- **Tasks** have SLA tracking with auto-escalation (24hr → priority bump, 48hr → notify other founder)
- **Enriched queries** join component/supplier/location names for dashboard display
- **Cron jobs** use `internalMutation` — not exposed to clients, only called by scheduler
- **Stock monitor** deduplicates alerts per component — won't create duplicates for the same issue
- **Receiving workflow** is atomic per PO — updates lines + stock + transactions + auto-resolves alerts in one mutation

## Conventions
- All timestamps are `Date.now()` (milliseconds since epoch)
- All tables have `updatedAt` for optimistic concurrency tracking
- IDs use Convex's built-in `v.id("tableName")` references
- Part numbers: `CCS-{TYPE}-{DETAIL}-{SEQ}` (e.g., `CCS-ESP32-C3-001`)
- PO numbers: `PO-{YEAR}-{SEQ}` (e.g., `PO-2026-001`)
- Build numbers: `BUILD-{PRODUCT_CODE}-{YEAR}-{SEQ}` (e.g., `BUILD-OH-2026-001`)

## Phase Status
- ✅ Phase 1: Google Drive MCP Server (in `packages/drive-mcp/`)
- ✅ Phase 2: Convex schema + backend mutations/queries
- ✅ Phase 3: Inventory agent + transaction workflows (stock monitor, receiving workflow, build workflow, task SLA escalation cron)
- ✅ Phase 4A: Cross-system intelligence (BOM sync, daily briefing, 3 new schema tables: bomChangeLogs, briefings, bomSnapshots)
- 🔲 Phase 4B: Build order lifecycle, inventory-mcp server, dashboard pages for BOM changes and briefings
