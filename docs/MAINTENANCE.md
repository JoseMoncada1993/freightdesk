# Maintenance Runbook

## Why the build can silently fail

The production build runs:

```
tsc -b && vite build
```

with strict TypeScript (`strict`, `noUnusedLocals`, `noUnusedParameters`).
If `tsc` finds any type error, the build fails and Cloudflare Pages keeps
serving the previous (old) bundle. The site does not show an error — it just
does not update.

A GitHub Actions workflow (`.github/workflows/typecheck.yml`) now runs the
same type check on every push / PR, so these errors show up in the commit's
"Checks" with the exact file and line, instead of silently failing the deploy.

## Database types must match the database

`src/lib/supabase.ts` types the Supabase client with the generated types in
`src/lib/database.types.ts`. If you add or change a column in the database but
do NOT update this file, any `.insert()` / `.update()` / `.select()` that uses
the new column will fail `tsc` (e.g. "Object literal may only specify known
properties").

### Whenever you change the database schema, regenerate the types

1. Install the Supabase CLI once: https://supabase.com/docs/guides/cli
2. Log in and link the project (project ref: pscoehsbcpxnmdgtplon):

   ```
   supabase login
   supabase link --project-ref pscoehsbcpxnmdgtplon
   ```

3. Regenerate the types file:

   ```
   supabase gen types typescript --linked > src/lib/database.types.ts
   ```

4. Commit the updated `src/lib/database.types.ts` together with the code that
   uses the new columns.

This keeps the TypeScript types in sync with the real schema and prevents the
"silent build failure" class of problems.

## Deployment

- Cloudflare Pages auto-builds on every push to `main`.
- Environment variables are baked in at build time from `.env.production`
  (committed) — only the public `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` belong there. Never commit the service-role key.
- After a push, confirm the deploy by checking that the hashed bundle name
  (`/assets/index-XXXX.js`) on the live site changes.

## Customers page

- The Customers page supports adding and editing customers in-app via the
  "New Customer" button and the per-row "Edit" link.
- Form fields map to these columns: first_name, last_name, company_name,
  address1, address2, city, state, zip_code, contact_phone (Phone Number),
  business_hours, facility_type (Type of Facility), special_instructions,
  contact_email (Email). A display `name` is derived automatically.

## Dashboard diesel widget

- `src/components/DieselWidget.tsx` embeds the oilpriceapi.com U.S. diesel
  price widget (no API key needed). To remove it, delete the `<DieselWidget />`
  block from `src/pages/Dashboard.tsx`.
