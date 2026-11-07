-- =====================================================================
-- Activity log: who changed what and when, for every inventory table.
-- Filled only by triggers; members can read it (history + dashboard feed).
-- Old/new row snapshots make every change (incl. deletes) recoverable.
-- =====================================================================

create table public.activity_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor_id   uuid references public.profiles (id) on delete set null,
  table_name text not null,
  row_id     text not null,
  action     text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  context    text,
  old_data   jsonb,
  new_data   jsonb
);
create index activity_log_row_idx on public.activity_log (table_name, row_id, at desc);
create index activity_log_at_idx  on public.activity_log (at desc);

create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
begin
  if tg_op = 'UPDATE' and (v_old - 'updated_at') = (v_new - 'updated_at') then
    return null;
  end if;
  insert into public.activity_log (actor_id, table_name, row_id, action, context, old_data, new_data)
  values (
    auth.uid(),
    tg_table_name,
    coalesce(v_new ->> 'id', v_old ->> 'id'),
    tg_op,
    nullif(current_setting('app.action', true), ''),
    v_old,
    v_new
  );
  return null;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['items', 'consumables', 'locations', 'events', 'event_consumables', 'shopping_list', 'categories'] loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_row()', t || '_audit', t);
  end loop;
end $$;

alter table public.activity_log enable row level security;
create policy activity_log_select on public.activity_log for select to authenticated using ((select public.is_member()));
revoke insert, update, delete on public.activity_log from authenticated;

-- functions from this and the previous migration: signed-in users only
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;
revoke all on all tables in schema public from anon;

-- realtime: inventory tables are already published; add the feed and profiles
alter publication supabase_realtime add table public.activity_log;
alter publication supabase_realtime add table public.profiles;
