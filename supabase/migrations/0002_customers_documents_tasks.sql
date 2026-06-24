-- Additive: customers, documents, tasks + loads.customer_id link.

create table if not exists public.customers (
  id bigint generated always as identity primary key,
  name text not null,
  contact_email text,
  contact_phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.loads add column if not exists customer_id bigint
  references public.customers(id) on delete set null;
create index if not exists idx_loads_customer on public.loads(customer_id);

create table if not exists public.documents (
  id bigint generated always as identity primary key,
  load_id bigint references public.loads(id) on delete cascade,
  doc_type text not null,
  file_path text not null,
  uploaded_at timestamptz not null default now()
);
create index if not exists idx_documents_load on public.documents(load_id);

create table if not exists public.tasks (
  id bigint generated always as identity primary key,
  title text not null,
  load_id bigint references public.loads(id) on delete set null,
  assignee text,
  status text not null default 'open',
  due_date date,
  created_at timestamptz not null default now()
);
create index if not exists idx_tasks_status on public.tasks(status);

alter table public.customers enable row level security;
alter table public.documents enable row level security;
alter table public.tasks enable row level security;

do $$
declare t text;
begin
  foreach t in array array['customers','documents','tasks'] loop
    begin
      execute format('create policy "authenticated_all_%1$s" on public.%1$s for all to authenticated using (true) with check (true);', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
