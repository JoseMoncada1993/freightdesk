# FreightDesk

A web application to manage logistics workflow for a logistics & data analyst —
shipments/loads, customers, carriers, document handling, task tracking, and
analytics dashboards.

## Stack
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **Data:** TanStack Query, React Router
- **Charts:** Recharts
- **Backend:** Supabase (Postgres, Auth, Storage)
- **Hosting:** Cloudflare Pages
- **CI:** GitHub Actions

## Quick start
```bash
npm install
cp .env.example .env   # fill in your Supabase URL + anon key
npm run dev
```

## Scripts
| Command | Purpose |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Typecheck + production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | TypeScript check, no emit |
| `npm run lint` | ESLint |
| `npm run deploy` | Build + deploy to Cloudflare Pages |
| `npm run db:types` | Generate TS types from Supabase schema |

## Database
Schema lives in `supabase/migrations/`. Apply `0001_init.sql` to your Supabase
project (via the dashboard SQL editor or the Supabase CLI).

See `ARCHITECTURE.md` for the full design and `CLAUDE.md` for agent guidance.
