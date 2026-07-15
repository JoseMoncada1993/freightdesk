-- 0024: Email Data Log module — replaces the "Control Tower Loads" Google
-- Sheet + Apps Script (importControlTowerLoads). Staff connect Gmail
-- (read-only, client-side OAuth — same google_client_id app setting as
-- Manifest Import), fetch messages matching a supplier rule, extract fields
-- from the email body, and log one row per email.
--
-- email_rules: per-supplier ingestion criteria. fields = jsonb array of
--   {key, label, pattern?} — pattern is an optional regex whose first capture
--   group is the value; when omitted the parser looks for "Label: value" /
--   "Label value" lines in the email body.
-- email_logs: one row per ingested email, deduped on gmail_message_id
--   (the Apps Script "Processed" sheet). data = jsonb {field key -> value}.

create table if not exists public.email_rules (
  id bigint generated always as identity primary key,
  name text not null unique,
  supplier text,
  gmail_query text not null,          -- e.g. subject:"Control Tower - Load Assigned"
  from_filter text,                   -- optional from: address filter
  fields jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_logs (
  id bigint generated always as identity primary key,
  rule_id bigint references public.email_rules(id) on delete set null,
  supplier text,
  gmail_message_id text not null unique,
  subject text,
  from_addr text,
  received_at timestamptz,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists email_logs_rule_idx on public.email_logs (rule_id);
create index if not exists email_logs_received_idx on public.email_logs (received_at desc);

alter table public.email_rules enable row level security;
alter table public.email_logs enable row level security;

create policy "email_rules_select_all" on public.email_rules
  for select to authenticated using (true);
create policy "email_rules_insert_dispatch" on public.email_rules
  for insert to authenticated with check (public.my_role() in ('admin','dispatcher'));
create policy "email_rules_update_dispatch" on public.email_rules
  for update to authenticated
  using (public.my_role() in ('admin','dispatcher'))
  with check (public.my_role() in ('admin','dispatcher'));
create policy "email_rules_delete_dispatch" on public.email_rules
  for delete to authenticated using (public.my_role() in ('admin','dispatcher'));

create policy "email_logs_select_all" on public.email_logs
  for select to authenticated using (true);
create policy "email_logs_insert_dispatch" on public.email_logs
  for insert to authenticated with check (public.my_role() in ('admin','dispatcher'));
create policy "email_logs_update_dispatch" on public.email_logs
  for update to authenticated
  using (public.my_role() in ('admin','dispatcher'))
  with check (public.my_role() in ('admin','dispatcher'));
create policy "email_logs_delete_dispatch" on public.email_logs
  for delete to authenticated using (public.my_role() in ('admin','dispatcher'));

-- Seed: the Control Tower Loads rule from the replaced Google Sheet.
-- Fields mirror the sheet's Loads tab columns; label-based extraction.
insert into public.email_rules (name, supplier, gmail_query, fields) values (
  'Control Tower Loads',
  'Sam''s Club Control Tower',
  'subject:"Control Tower - Load Assigned"',
  '[
    {"key": "order_date",       "label": "Order Date"},
    {"key": "carrier_code",     "label": "Carrier Code"},
    {"key": "carrier_name",     "label": "Carrier Name"},
    {"key": "trailer",          "label": "Trailer"},
    {"key": "seal_number",      "label": "Seal Number"},
    {"key": "category",         "label": "Category"},
    {"key": "bol_number",       "label": "BOL Number"},
    {"key": "pickup_name",      "label": "Pickup Name"},
    {"key": "pickup_address",   "label": "Pickup Address"},
    {"key": "pickup_city",      "label": "Pickup City"},
    {"key": "pickup_state",     "label": "Pickup State"},
    {"key": "pickup_zip",       "label": "Pickup Zip"},
    {"key": "delivery_name",    "label": "Delivery Name"},
    {"key": "delivery_address", "label": "Delivery Address"},
    {"key": "delivery_city",    "label": "Delivery City"},
    {"key": "delivery_state",   "label": "Delivery State"},
    {"key": "delivery_zip",     "label": "Delivery Zip"}
  ]'::jsonb
) on conflict (name) do nothing;
