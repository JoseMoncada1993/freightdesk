-- Applied live on 2026-07-03 as "improvements_pt4_recurring_tasks_broker_mode".
-- Recurring tasks: recurrence cadence stored on the task; the app spawns the
-- next occurrence when a recurring task is completed.
alter table public.tasks add column if not exists recurrence text not null default 'none';
alter table public.tasks drop constraint if exists tasks_recurrence_check;
alter table public.tasks add constraint tasks_recurrence_check check (
  recurrence in ('none','daily','weekly','biweekly','monthly')
);

-- Carriers: allow 'broker' mode
alter table public.carriers drop constraint if exists carriers_mode_check;
alter table public.carriers add constraint carriers_mode_check check (
  mode = any (array['truckload','ltl','intermodal','parcel','freight_forwarder','customs_broker','broker'])
);
