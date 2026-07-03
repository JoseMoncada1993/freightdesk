# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

FreightDesk is a TMS/WMS web app for a freight brokerage / 3PL: it tracks loads,
carriers, lanes, customers, drop trailers (yard board), warehouse inventory,
documents, and tasks, and surfaces operational analytics. It is a static React SPA that talks directly to Supabase
(Postgres + Auth + Storage) and deploys to Cloudflare Pages. There is no custom
backend server — access control lives in Postgres Row Level Security.

## Commands

```bash
npm install            # install deps
npm run dev            # Vite dev server at http://localhost:5173
npm run build          # tsc -b (typecheck) then production build to dist/
npm run preview        # serve the built dist/ locally
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint
npm run deploy         # build, then wrangler pages deploy dist
npm run db:types       # regenerate src/lib/database.types.ts from the live schema
```

There is no test runner configured yet. `npm run build` is the gate — it runs the
TypeScript compiler under strict settings (`noUnusedLocals`, `noUnusedParameters`),
so unused imports/params fail the build.

Requires a `.env` (copied from `.env.example`) with `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY`. Only `VITE_`-prefixed vars are exposed to the client;
never put a service-role key there.

## Architecture

**Data flow.** Components never fetch directly. Server state goes through TanStack
Query hooks (`src/hooks/`, e.g. `useLoads`) that call the typed Supabase client in
`src/lib/supabase.ts`. The client is generically typed by `src/lib/database.types.ts`,
which is generated from the live database — regenerate it after any schema change
rather than editing it by hand. `src/lib/types.ts` re-exports row types from the
generated file so app code imports domain types from one place.

**Read model.** The app reads loads through the `loads_enriched` Postgres view, not
the raw `loads` table. The view denormalizes carrier name/mode and lane
origin/destination/miles onto each load, so the UI avoids client-side joins. When
adding columns the UI needs, prefer extending the view. Writes go to the base
tables (or the `add_load()` RPC).

**Routing/layout.** `src/main.tsx` mounts the Router and the React Query provider.
`src/App.tsx` defines routes; all pages render inside `components/Layout.tsx`
(persistent `Sidebar`). Each module has one page in `src/pages/`
(Dashboard, Shipments, Billing, Trailers, Inventory, Customers, Carriers, Documents, Tasks).
`src/features/<module>/`
is where domain-specific components/hooks/API calls should be co-located as modules grow.

**Path alias.** `@/` → `src/` (configured in both `vite.config.ts` and `tsconfig.json`).

## Database

Postgres schema is in `supabase/migrations/`:
- `0001_core_existing.sql` — `carriers`, `lanes`, `loads`, the `loads_enriched`
  view, and the `add_load()` RPC (the original FreightDesk core).
- `0002_customers_documents_tasks.sql` — adds `customers`, `documents`, `tasks`,
  and a nullable `loads.customer_id` link.
- `0003_yard_trailers.sql` — drop trailer / yard board: `yard_trailers` +
  `yard_trailers_enriched` view.
- `0004_warehouse_inventory.sql` — WMS core: `warehouses`, `inventory_items`,
  `inventory_levels`, `inventory_movements`, the `record_inventory_movement()`
  RPC (atomic ledger write + level upsert), enriched inventory views, the
  private `documents` storage bucket, and `security_invoker = on` for all
  enriched views so RLS applies through them.

Inventory writes must go through `record_inventory_movement()` so the movement
ledger and `inventory_levels` stay consistent — never update `qty_on_hand`
directly.

Keys use `bigint generated always as identity`. `loads` is the hub; `documents`
and `tasks` reference it via `load_id`. All tables have RLS enabled with a starter
policy granting authenticated users full access — tighten these before production.
Apply migrations via the Supabase dashboard SQL editor or the Supabase CLI/MCP.

## Deployment

Cloudflare Pages serves the static `dist/` build (`wrangler.toml`,
`pages_build_output_dir = "dist"`). `public/_redirects` provides the SPA fallback
(`/* /index.html 200`) so client-side routes resolve on hard refresh. CI
(`.github/workflows/ci.yml`) runs typecheck + build on push/PR to `main`.
