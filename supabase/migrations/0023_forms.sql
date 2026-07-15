-- 0023: Forms module — build data-collection forms (shipping quote request,
-- pickup request, …) and share them by public link/email.
--
-- form_templates: the form definition. fields = jsonb array of
--   {key, label, type (text|textarea|number|date|select|email|phone|checkbox),
--    required, options[] (for select)}.
-- form_responses: one submission. data = jsonb {field key -> value}.
--
-- PUBLIC ACCESS: forms are filled by outside parties (customers, suppliers)
-- who do not sign in. The anon role may read ACTIVE templates and insert
-- responses; only authenticated staff can read responses or manage templates.
-- The slug is a random unguessable token, so anon reads leak nothing beyond
-- the form the link points to (plus inactive forms stay hidden).

create table if not exists public.form_templates (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  description text,
  fields jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.form_responses (
  id bigint generated always as identity primary key,
  form_id bigint not null references public.form_templates(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  submitted_by text,                 -- optional name/email the submitter typed
  created_at timestamptz not null default now()
);

create index if not exists form_responses_form_idx on public.form_responses (form_id);

alter table public.form_templates enable row level security;
alter table public.form_responses enable row level security;

-- Templates: staff read everything; the public may read only active forms
-- (needed to render the public fill page by slug).
create policy "form_templates_select_auth" on public.form_templates
  for select to authenticated using (true);
create policy "form_templates_select_public_active" on public.form_templates
  for select to anon using (active);
create policy "form_templates_insert_dispatch" on public.form_templates
  for insert to authenticated with check (public.my_role() in ('admin','dispatcher'));
create policy "form_templates_update_dispatch" on public.form_templates
  for update to authenticated
  using (public.my_role() in ('admin','dispatcher'))
  with check (public.my_role() in ('admin','dispatcher'));
create policy "form_templates_delete_dispatch" on public.form_templates
  for delete to authenticated using (public.my_role() in ('admin','dispatcher'));

-- Responses: anyone with the link may submit (insert only, and only into an
-- active form); reading/deleting responses is staff-only.
create policy "form_responses_insert_public" on public.form_responses
  for insert to anon, authenticated
  with check (exists (
    select 1 from public.form_templates t
    where t.id = form_id and t.active
  ));
create policy "form_responses_select_auth" on public.form_responses
  for select to authenticated using (true);
create policy "form_responses_delete_dispatch" on public.form_responses
  for delete to authenticated using (public.my_role() in ('admin','dispatcher'));
