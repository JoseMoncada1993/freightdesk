# FreightDesk — Architecture & Project Reference

## 1. Project Overview

FreightDesk is a web application for managing day-to-day logistics workflow from
the perspective of a logistics and data analyst. It centralizes the operational
records and the reporting that a freight desk runs on, replacing scattered
spreadsheets with a single, queryable system.

The application is organized around four functional modules:

- **Shipments / Loads** — the core record. Each shipment tracks a reference,
  origin and destination lanes, the assigned customer and carrier, status
  through its lifecycle (quoted → booked → in transit → delivered), pickup and
  delivery dates, and rate.
- **Customers & Carriers** — the parties on each shipment. Customers hold
  contact details; carriers additionally track SCAC and MC numbers used in U.S.
  freight operations.
- **Documents & Tasks** — the workflow layer. Documents (BOLs, invoices, proof
  of delivery) are attached to shipments and stored in Supabase Storage; tasks
  capture follow-up work with an assignee, due date, and status.
- **Dashboards & Analytics** — the analyst view. KPIs (active shipments,
  on-time percentage, open tasks, customer counts) and charts (monthly load
  volume) surface operational health at a glance.

The system is built as a single-page application backed by a managed Postgres
database, deployed to a global edge network. It is designed to start simple and
grow: the schema and folder layout leave room for auth roles, additional
reporting, and per-customer rate management without restructuring.

## 2. Tech Stack & Dependencies

**Frontend**

- React 18 with TypeScript, bundled by Vite for fast dev and optimized builds.
- Tailwind CSS for styling, with a small brand color extension.
- React Router for client-side routing across module pages.
- TanStack Query for server-state management, caching, and data fetching.
- Recharts for the analytics visualizations.

**Backend & data**

- Supabase provides the Postgres database, authentication, and file storage.
- `@supabase/supabase-js` is the typed client; database types are generated
  from the live schema via `supabase gen types`.

**Tooling & infrastructure**

- Vite, ESLint, and the TypeScript compiler for build, lint, and typecheck.
- Wrangler for Cloudflare Pages deployment.
- GitHub Actions for CI (typecheck + build on every push and PR).

**Key runtime dependencies**

| Package | Role |
|---|---|
| `react`, `react-dom` | UI runtime |
| `react-router-dom` | Routing |
| `@tanstack/react-query` | Data fetching / cache |
| `@supabase/supabase-js` | Backend client |
| `recharts` | Charts |
| `tailwindcss`, `autoprefixer`, `postcss` | Styling pipeline |
| `vite`, `@vitejs/plugin-react` | Build tooling |
| `typescript`, `eslint` | Static analysis |
| `wrangler` | Deployment |

## 3. Architecture & Folder Structure

The app is a static SPA: the browser loads the built bundle from Cloudflare
Pages and talks directly to Supabase over HTTPS. Row Level Security in Postgres
enforces access, so no custom API server is required for the initial scope.

```
Freight desk/
├── .github/workflows/ci.yml        # typecheck + build CI
├── public/
│   └── _redirects                  # SPA fallback for Cloudflare Pages
├── src/
│   ├── main.tsx                    # entry: providers (Router, Query)
│   ├── App.tsx                     # route definitions
│   ├── index.css                   # Tailwind layers
│   ├── lib/
│   │   ├── supabase.ts             # configured Supabase client
│   │   ├── types.ts                # domain types
│   │   └── database.types.ts       # generated DB types (npm run db:types)
│   ├── components/
│   │   ├── Layout.tsx              # sidebar + content shell
│   │   ├── Sidebar.tsx             # module navigation
│   │   ├── PageHeader.tsx          # shared page header
│   │   └── ui/StatCard.tsx         # KPI card
│   ├── pages/                      # one page per module
│   │   ├── Dashboard.tsx
│   │   ├── Shipments.tsx
│   │   ├── Customers.tsx
│   │   ├── Carriers.tsx
│   │   ├── Documents.tsx
│   │   └── Tasks.tsx
│   ├── features/                   # domain logic co-located per module
│   │   ├── shipments/  customers/  carriers/  documents/  tasks/
│   └── hooks/
│       └── useShipments.ts         # example data hook
├── supabase/
│   └── migrations/0001_init.sql    # schema: tables, enums, RLS
├── wrangler.toml                   # Cloudflare Pages config
├── .env.example                    # required env vars
├── index.html  package.json  tsconfig*.json  vite.config.ts
├── tailwind.config.js  postcss.config.js  .eslintrc.cjs  .gitignore
├── README.md  ARCHITECTURE.md  CLAUDE.md
```

**Data model (Postgres / Supabase)**

- `customers` — id, name, contact email/phone.
- `carriers` — id, name, SCAC, MC number, contact email.
- `shipments` — id, unique reference, customer and carrier FKs, origin,
  destination, `shipment_status` enum, pickup/delivery dates, rate.
- `documents` — id, shipment FK, doc type, file path, uploaded_at.
- `tasks` — id, title, optional shipment FK, assignee, `task_status` enum,
  due date.

All tables enable Row Level Security with a starter policy granting authenticated
users full access; tighten these per role as auth requirements firm up.

**Conventions**

- Path alias `@/` maps to `src/`.
- Server state goes through TanStack Query hooks in `src/hooks` or per-feature
  folders, never raw fetches in components.
- Only `VITE_`-prefixed env vars reach the client; never expose the service-role
  key.

## 4. Key Development Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Start the Vite dev server at `localhost:5173` |
| `npm run build` | Run `tsc -b` then build the production bundle to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript check with no emit |
| `npm run lint` | Run ESLint |
| `npm run deploy` | Build, then `wrangler pages deploy dist` |
| `npm run db:types` | Generate `src/lib/database.types.ts` from the live schema |

**First-run setup**

```bash
npm install
cp .env.example .env          # add VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
# apply supabase/migrations/0001_init.sql to your Supabase project
npm run dev
```

**Deploy**

```bash
npm run build
npx wrangler pages deploy dist --project-name freightdesk
```
