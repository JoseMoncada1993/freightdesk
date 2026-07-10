-- 0021: Manifest Import module (applied live 2026-07-09).
-- - manifests: one imported manifest file (uploaded, or fetched from Gmail /
--   Google Drive). rows = jsonb array of objects keyed by the 22 manifest
--   template headers; linked to a generated SKU via sku_id.
-- - manifest_mappings: reusable source-header -> template-header mappings
--   (seeded with the Wayfair mapping from Manifest Import Template 4.2.26).
-- - pricing_rules: auto-pricing by supplier/location/program (null = any);
--   pct = "Your Price %" of EXT retail. Most specific rule wins.
-- - app_settings: small admin-editable key/value store (Google OAuth client id).

create table if not exists public.manifests (
  id bigint generated always as identity primary key,
  sku_id bigint references public.skus(id) on delete set null,
  source text not null default 'upload',      -- upload | gmail | drive
  source_ref text,                             -- email subject / drive path
  file_name text,
  mapping jsonb,                               -- source header -> template header
  rows jsonb not null default '[]'::jsonb,     -- [{"Pallet ID": "...", ...}]
  item_count integer,
  total_qty numeric,
  ext_retail numeric,
  price_pct numeric,                           -- Your Price % (of EXT retail)
  ext_price numeric,                           -- Your EXT Price
  status text not null default 'imported',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.manifest_mappings (
  id bigint generated always as identity primary key,
  name text not null unique,
  mapping jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.pricing_rules (
  id bigint generated always as identity primary key,
  supplier text not null,
  location text,
  program text,
  pct numeric not null,                        -- your price as % of EXT retail
  notes text,
  created_at timestamptz not null default now()
);
create unique index if not exists pricing_rules_key
  on public.pricing_rules (supplier, coalesce(location, ''), coalesce(program, ''));

create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);

alter table public.manifests enable row level security;
alter table public.manifest_mappings enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.app_settings enable row level security;

create policy "manifests_select_all" on public.manifests
  for select to authenticated using (true);
create policy "manifests_insert_dispatch" on public.manifests
  for insert to authenticated with check (public.my_role() in ('admin','dispatcher'));
create policy "manifests_update_dispatch" on public.manifests
  for update to authenticated
  using (public.my_role() in ('admin','dispatcher'))
  with check (public.my_role() in ('admin','dispatcher'));
create policy "manifests_delete_dispatch" on public.manifests
  for delete to authenticated using (public.my_role() in ('admin','dispatcher'));

create policy "manifest_mappings_select_all" on public.manifest_mappings
  for select to authenticated using (true);
create policy "manifest_mappings_insert_dispatch" on public.manifest_mappings
  for insert to authenticated with check (public.my_role() in ('admin','dispatcher'));
create policy "manifest_mappings_update_dispatch" on public.manifest_mappings
  for update to authenticated
  using (public.my_role() in ('admin','dispatcher'))
  with check (public.my_role() in ('admin','dispatcher'));
create policy "manifest_mappings_delete_dispatch" on public.manifest_mappings
  for delete to authenticated using (public.my_role() in ('admin','dispatcher'));

create policy "pricing_rules_select_all" on public.pricing_rules
  for select to authenticated using (true);
create policy "pricing_rules_insert_dispatch" on public.pricing_rules
  for insert to authenticated with check (public.my_role() in ('admin','dispatcher'));
create policy "pricing_rules_update_dispatch" on public.pricing_rules
  for update to authenticated
  using (public.my_role() in ('admin','dispatcher'))
  with check (public.my_role() in ('admin','dispatcher'));
create policy "pricing_rules_delete_dispatch" on public.pricing_rules
  for delete to authenticated using (public.my_role() in ('admin','dispatcher'));

create policy "app_settings_select_all" on public.app_settings
  for select to authenticated using (true);
create policy "app_settings_insert_admin" on public.app_settings
  for insert to authenticated with check (public.my_role() = 'admin');
create policy "app_settings_update_admin" on public.app_settings
  for update to authenticated
  using (public.my_role() = 'admin')
  with check (public.my_role() = 'admin');
create policy "app_settings_delete_admin" on public.app_settings
  for delete to authenticated using (public.my_role() = 'admin');

-- Seed: the Wayfair source -> template mapping used by the old Excel macro.
insert into public.manifest_mappings (name, mapping) values (
  'Wayfair',
  '{
    "PalletID": "Pallet ID",
    "WayfairID": "Item ID",
    "ProductUPCorEAN": "UPC",
    "ProductName": "Description",
    "ProductCategory": "Category",
    "ProductManufacturer": "Manufacturer",
    "ProductPartNumber": "Model",
    "ProductType": "Subcategory",
    "ProductStyle": "Color",
    "Quantity": "Quantity",
    "PricePerCarton": "Appx. Unit Retail",
    "ProductImageURL": "Notes"
  }'::jsonb
) on conflict (name) do nothing;
