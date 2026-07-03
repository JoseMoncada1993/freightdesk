-- Applied live on 2026-07-03 as "customer_addresses".
-- Multiple addresses per customer (pickup docks, DCs, billing, etc.).

create table if not exists public.customer_addresses (
  id bigint generated always as identity primary key,
  customer_id bigint not null references public.customers(id) on delete cascade,
  label text not null,
  address1 text,
  address2 text,
  city text,
  state text,
  zip_code text,
  contact_name text,
  contact_phone text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_customer_addresses_customer on public.customer_addresses(customer_id);

alter table public.customer_addresses enable row level security;
do $$
begin
  begin
    create policy "authenticated_all_customer_addresses" on public.customer_addresses
      for all to authenticated using (true) with check (true);
  exception when duplicate_object then null;
  end;
end $$;
