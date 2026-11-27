-- =====================================================================
-- Fixes for Supabase advisors (2026-11-27).
-- =====================================================================

-- ---------- security: members-only RPCs must not be callable signed out ----------
-- (Supabase default privileges grant EXECUTE to anon on new functions;
-- the functions checked membership anyway, this closes the door earlier)
revoke execute on function public.current_join_code() from anon, public;
revoke execute on function public.regenerate_join_code() from anon, public;

-- ---------- security: trigger functions are not an API ----------
-- EXECUTE is checked only when a trigger is created, so firing still works.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;

-- ---------- performance: one UPDATE policy on profiles instead of two ----------
drop policy profiles_update_self on public.profiles;
drop policy profiles_update_admin on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));
-- role changes are still guarded by the profiles_guard trigger

-- ---------- performance: indexes for foreign keys ----------
create index if not exists activity_log_actor_idx        on public.activity_log (actor_id);
create index if not exists consumables_location_idx      on public.consumables (location_id);
create index if not exists consumables_responsible_idx   on public.consumables (responsible_id);
create index if not exists items_home_location_idx       on public.items (home_location_id);
create index if not exists items_responsible_idx         on public.items (responsible_id);
create index if not exists locations_responsible_idx     on public.locations (responsible_id);
create index if not exists locations_stored_at_idx       on public.locations (stored_at_id);
create index if not exists shopping_category_idx         on public.shopping_list (category_id);
create index if not exists shopping_requested_by_idx     on public.shopping_list (requested_by);
