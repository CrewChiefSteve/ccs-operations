# CCS Operations Mobile App

Internal warehouse & inventory operations app for CCS Technologies.

## Quick Start

```bash
cd apps/mobile
pnpm install
npx expo start --dev-client
```

## Prerequisites

Before running, set your environment values in `app.json > expo.extra`:

| Key | Value |
|-----|-------|
| `clerkPublishableKey` | Your Clerk publishable key (same org as web dashboard) |
| `convexUrl` | `https://rugged-heron-983.convex.cloud` |
| `eas.projectId` | Your EAS project ID after running `eas init` |

## Architecture

- **Expo Router** (file-based routing) in `app/` directory
- **Convex** for real-time data (same deployment as web: `rugged-heron-983`)
- **Clerk** for auth (Google SSO, using `@clerk/clerk-expo` + SecureStore)
- Bottom tab navigation: Dashboard, Receive, Count, Tasks, Alerts
- Hidden screens accessible via navigation: Component Lookup, PO Detail

## Key Patterns

### Convex Queries
All screens use `useQuery` with string function paths. These are temporary until the
app is properly wired into the monorepo's Convex codegen. Replace with typed `api.*`
imports once integrated:

```ts
// Current (works but untyped):
const data = useQuery('inventory/components:list' as any);

// Target (after monorepo integration):
import { api } from '../../../convex/_generated/api';
const data = useQuery(api.inventory.components.list);
```

### Camera / Barcode Scanning
Requires EAS dev builds — Expo Go doesn't support native camera modules:

```bash
eas build --profile development --platform ios
# or
eas build --profile development --platform android
```

### Real-Time Updates
All data subscriptions are real-time via Convex. No polling, no manual refresh needed.
The pull-to-refresh on Dashboard is UX sugar (Convex already updates live).

## File Structure

```
apps/mobile/
├── app/
│   ├── _layout.tsx              # Root: providers + auth gate
│   ├── sign-in.tsx              # Clerk Google SSO login
│   └── (tabs)/
│       ├── _layout.tsx          # Bottom tab navigator
│       ├── index.tsx            # Dashboard / Home
│       ├── receive.tsx          # PO list for receiving
│       ├── po-detail.tsx        # PO receiving workflow (hidden tab)
│       ├── count.tsx            # Inventory count by location
│       ├── tasks.tsx            # Meat Bag Director task queue
│       ├── alerts.tsx           # Active alerts
│       └── component-lookup.tsx # Search/scan components (hidden tab)
├── src/
│   ├── providers/
│   │   └── ConvexClerkProvider.tsx
│   ├── theme/
│   │   └── colors.ts            # Dark theme, status colors, spacing
│   ├── components/
│   │   ├── ui.tsx               # Shared: Card, StatusBadge, ActionButton, etc.
│   │   └── Scanner.tsx          # Barcode/QR scanner modal
│   └── convex-api.ts            # API function reference docs
├── app.json                     # Expo config
├── eas.json                     # EAS Build profiles
├── babel.config.js
├── tsconfig.json
└── package.json
```

## Convex Backend Functions Used

### Queries
- `dashboard:overview` — operational snapshot
- `inventory/components:list`, `:get`, `:search`
- `inventory/stock:getByComponent`, `:getByLocation`
- `inventory/purchaseOrders:list`, `:get`, `:getLines`
- `inventory/locations:list`, `:getTree`
- `agent/alerts:listActive`, `:getStats`
- `agent/tasks:listPending`

### Mutations
- `inventory/purchaseOrders:receiveLine`
- `inventory/stock:recordCount`
- `agent/alerts:acknowledge`, `:resolve`, `:dismiss`
- `agent/tasks:complete`, `:updateStatus`

## Design Decisions

- **Dark theme** — matches web dashboard, better for warehouse use
- **48px minimum touch targets** — gloves-friendly
- **Status colors** — red (critical), orange (warning), green (success), blue (info)
- **Haptic feedback** — success/warning haptics on key actions
- **Online-only** — offline support deferred to Phase 5

## Next Steps

1. Wire into monorepo's Convex codegen for typed API calls
2. Add photo upload to Convex file storage for PO receiving
3. Add push notifications via Expo Push for alerts
4. Generate QR codes for locations and components
5. Offline queue for operations when warehouse has spotty WiFi
