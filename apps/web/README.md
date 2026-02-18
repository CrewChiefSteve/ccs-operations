# CCS Operations Dashboard — `apps/web`

Next.js operations dashboard for CCS Technologies internal platform.

## Tech Stack

- **Next.js 15** (App Router) + **React 19**
- **Convex** (real-time backend) — deployed to `ccs-operations` project
- **Clerk** (auth) — same org as crewchiefsteve.ai
- **Tailwind CSS 3** — dark theme, industrial/mission-control aesthetic
- **TypeScript** end-to-end

## Pages

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard` | Operations Dashboard | Key metrics, low stock, recent alerts, pending tasks, active POs/builds |
| `/catalog` | Component Catalog | Browse, search, filter, add components |
| `/inventory` | Stock Levels | Inventory by component/location, adjust stock |
| `/suppliers` | Supplier Directory | Manage suppliers, contacts, ratings |
| `/orders` | Purchase Orders | Full PO lifecycle: draft → submit → confirm → ship → receive |
| `/builds` | Build Orders | Production tracking: planned → reserved → in progress → QC → complete |
| `/tasks` | Task Queue | Agent-assigned + manual tasks with priority/status management |
| `/alerts` | Alert Center | Low stock, PO overdue, QC failures — acknowledge/resolve/dismiss |

## Setup

### 1. Prerequisites

- Node.js 20+
- pnpm (monorepo workspace)
- Convex backend deployed (done — `ccs-operations` project)
- Clerk account with application configured

### 2. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in values:

```bash
cp .env.local.example .env.local
```

Required variables:
- `NEXT_PUBLIC_CONVEX_URL` — Your Convex deployment URL (from Convex dashboard)
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — From Clerk dashboard
- `CLERK_SECRET_KEY` — From Clerk dashboard

### 3. Install Dependencies

From the monorepo root:
```bash
pnpm install
```

Or from `apps/web`:
```bash
pnpm install
```

### 4. Run Development Server

```bash
pnpm dev
```

Dashboard will be at `http://localhost:3000`.

### 5. Convex Integration

The dashboard imports the Convex API from the monorepo root:
```typescript
import { api } from "@convex/_generated/api";
```

This is configured via tsconfig path alias:
```json
"@convex/*": ["../../convex/*"]
```

Make sure `convex dev` is running (from the monorepo root) to keep the generated types in sync.

## Convex API Contract

See `CONVEX_API_CONTRACT.md` for the full list of queries and mutations each page expects from the Convex backend.

## Architecture Notes

- **Real-time**: All data tables use Convex `useQuery` hooks — changes appear instantly, no polling
- **Auth**: Clerk middleware protects all routes except `/sign-in` and `/sign-up`
- **Sidebar**: Collapsible sidebar with section-grouped navigation
- **Modals**: Create/edit forms use modals to avoid page transitions
- **Status management**: All status transitions (PO lifecycle, build lifecycle, task/alert states) are handled through Convex mutations with explicit transition controls

## Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `surface-0` | `#0a0a0c` | Page background |
| `surface-1` | `#111114` | Cards, sidebar |
| `surface-2` | `#1a1a1f` | Elevated cards, inputs |
| `surface-3` | `#232329` | Hover states |
| `surface-4` | `#2e2e36` | Borders |
| `accent` | `#e85d26` | CCS racing orange — primary actions |
| Font: Display | DM Sans | Headings, body |
| Font: Data | JetBrains Mono | Part numbers, quantities, PO numbers |
