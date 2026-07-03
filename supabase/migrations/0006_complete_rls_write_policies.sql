-- Applied live on 2026-07-03 as "complete_rls_write_policies".
-- Root cause of "failing to save load": lanes (and loads/carriers/yard_trailers)
-- had SELECT-only or partial RLS policies, so inserting a lane during shipment
-- creation was forbidden. Grant authenticated users full access, consistent
-- with the rest of the schema.
do $$
declare t text;
begin
  foreach t in array array['lanes','loads','carriers','yard_trailers'] loop
    begin
      execute format('create policy "authenticated_all_%1$s" on public.%1$s for all to authenticated using (true) with check (true);', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- Archive flag for gated-out drop trailers
alter table public.yard_trailers add column if not exists archived boolean not null default false;
