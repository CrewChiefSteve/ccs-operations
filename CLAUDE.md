# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is
Internal operations platform for CCS Technologies. Manages inventory, warehouse, purchasing, build orders, and Google Drive engineering docs. Completely separate from the customer-facing crewchiefsteve.ai.

## Architecture
- **Convex** backend with 20 tables (see `convex/schema.ts`)
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
│   ├── buildOrders.ts           # Build order lifecycle (CRUD + simple status transition)
│   ├── buildLifecycle.ts        # Full lifecycle orchestration: reserve→build→QC→complete (Phase 4B)
│   ├── buildWorkflow.ts         # Material reservation, consumption, release + BOM feasibility
│   ├── transactions.ts          # Append-only inventory audit trail
│   ├── stockmonitor.ts          # Internal mutations: stock threshold + overdue PO checks
│   ├── receiving.ts             # Full receive-from-PO workflow (PO→txn→stock→alerts)
│   ├── supplierApi.ts           # Supplier API integration — stubbed for DigiKey/Mouser/LCSC (Phase 5)
│   ├── costing.ts               # COGS calculation + cost snapshots (Phase 5)
│   └── receiptPhotos.ts         # Receipt photo upload/query via Convex storage (Phase 5)
├── analytics.ts                 # Historical analytics aggregation queries (Phase 5)
├── users.ts                     # User profile CRUD + role management (Phase 5)
├── lib/
│   └── auth.ts                  # Auth helpers (requireAuth, requireAdmin, getCurrentUserId)
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
| `/analytics` | Historical analytics + charts (Phase 5) |
| `/pricing` | Supplier pricing comparison (Phase 5) |
| `/costing` | COGS calculator + cost history (Phase 5) |
| `/labels` | QR label generator (PO, build, component, location) |
| `/settings` | User management + role admin (Phase 5) |

UI components live in `apps/web/src/components/ui/`. Chart components in `apps/web/src/components/charts/`. Status badge colors and label configs are in `apps/web/src/lib/constants.ts`.

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

## React Version Coexistence (React 18 + 19)

This monorepo runs **two different React versions**: `apps/web` uses React 19 (Next.js 15) and `apps/mobile` uses React 18 (Expo 52 / React Native 0.76). This is a recurring source of crashes and build failures. **Read this section before touching React, package.json, .npmrc, or Metro config.**

### The Problem
pnpm hoists one version of shared dependencies to the root `node_modules/`. If React 19 gets hoisted, the mobile app crashes on startup with `"Objects are not valid as a React child"` or `"Cannot read property 'useEffect' of null"`. If React 18 gets hoisted, the web app's Next.js build fails.

### Current Solution (3 layers)

**Layer 1: Root package.json — React 19 for web builds**
```json
"dependencies": {
  "react": "^19.0.0",
  "react-dom": "^19.0.0"
}
```
This ensures React 19 is available at root for the web app's Vercel builds.

**Layer 2: .npmrc — Anti-hoist rules**
```ini
node-linker=hoisted
public-hoist-pattern[]=!react
public-hoist-pattern[]=!react-dom
public-hoist-pattern[]=*
```
Tells pnpm NOT to hoist react/react-dom, so each app gets its own version in its local `node_modules/`. In practice, pnpm still puts React 19 at root (from root deps) and React 18 in `apps/mobile/node_modules/`.

**Layer 3: Metro resolveRequest — Force React 18 in mobile bundle**
`apps/mobile/metro.config.js` uses a `resolveRequest` hook that intercepts **every** import of `react`, `react/jsx-runtime`, `react/jsx-dev-runtime`, `react-dom`, and `react-native` — regardless of which package is importing them — and forces resolution to `apps/mobile/node_modules/react` (18.3.1). This is the critical layer. `extraNodeModules` alone is NOT sufficient because transitive dependencies (Clerk, Convex, etc.) resolve from the monorepo root.

### Checklist: When Modifying Dependencies

- [ ] **Never** change root `react`/`react-dom` versions without checking mobile build
- [ ] **Never** remove the `resolveRequest` hook from `metro.config.js`
- [ ] After any `pnpm install`, verify: `apps/mobile/node_modules/react/package.json` → version 18.3.1
- [ ] After any `pnpm install`, verify: `node_modules/react/package.json` → version 19.x (for web)
- [ ] If adding new React-dependent packages, test both `pnpm build` (web) AND mobile APK build
- [ ] If Expo SDK upgrades change the required React version, update all three layers

### Future Improvement (from Portal project)
Consider adding pnpm overrides to pin `@types/react` and `@types/react-dom` across all workspaces:
```json
"pnpm": {
  "overrides": {
    "@types/react": "18.2.79",
    "@types/react-dom": "18.2.25"
  }
}
```
And add Expo-specific hoisting patterns to `.npmrc`:
```ini
public-hoist-pattern[]=*react-native*
public-hoist-pattern[]=*expo*
public-hoist-pattern[]=*babel*
public-hoist-pattern[]=@react-native/*
public-hoist-pattern[]=@expo/*
public-hoist-pattern[]=@babel/*
```
And exclude pinned types from Expo's auto-fix in mobile `package.json`:
```json
"expo": { "install": { "exclude": ["@types/react"] } }
```

### Deployment Architecture
- **Convex** (backend): Deployed with `npx convex deploy --yes`. Takes effect instantly for both web and mobile — no rebuilds needed.
- **Vercel** (web frontend): Deployed via git push to `master`. Only affects `apps/web`.
- **Mobile APK**: Built locally or via EAS. Must be rebuilt for any `apps/mobile/` code changes. Backend (Convex) changes do NOT require a mobile rebuild.

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

## MCP Servers

| Package | Purpose |
|---|---|
| `packages/drive-mcp/` | Google Drive read access (Phase 1) |
| `packages/inventory-mcp/` | Read-only inventory/build/ops queries (Phase 4B) — 16 tools, 3 resources, 4 prompts |

The `inventory-mcp` connects via `ConvexHttpClient` to `CONVEX_URL` (dev: `rugged-heron-983.convex.cloud`). Configure in `~/.claude/claude_desktop_config.json`.

## QR Code Formats

The mobile app Scanner component reads these QR formats:

| Entity | QR Value | Scanned By | Example |
|---|---|---|---|
| Location | Convex `_id` string | Count screen (matches `locationId`) | `jh7abcd123ef456` |
| Component | `partNumber` string | Receive screen, Component Lookup | `CCS-MCU-001` |
| Purchase Order | `PO:{poNumber}` | Receive screen (strips `PO:` prefix) | `PO:PO-2026-001` |

The web dashboard label generator at `/labels` produces QR codes in these formats.

## Phase Status
- ✅ Phase 1: Google Drive MCP Server (in `packages/drive-mcp/`)
- ✅ Phase 2: Convex schema + backend mutations/queries
- ✅ Phase 3: Inventory agent + transaction workflows (stock monitor, receiving workflow, build workflow, task SLA escalation cron)
- ✅ Phase 4A: Cross-system intelligence (BOM sync, daily briefing, 3 new schema tables: bomChangeLogs, briefings, bomSnapshots)
- ✅ Phase 4B: Build order lifecycle (`buildLifecycle.ts`), inventory MCP server (`packages/inventory-mcp/`)
- ✅ Phase 4 (Mobile+Web): Expo Push Notifications via Convex (`convex/notifications.ts`, `pushTokens` table), QR label generator (`/labels`)
- ✅ Phase 5: Polish + Scale — supplier API stubs, COGS tracking, analytics, receipt photos, multi-user roles, QR enhancements (3 new tables: `userProfiles`, `supplierApiConfigs`, `productCosts`)
