-- =====================================================================
-- Auth, roles and RLS.
-- Model: anyone can sign up (email/password or Google) -> role 'guest'.
-- A guest becomes 'member' by entering the club join code (join_club()).
-- Members can read and modify inventory; admins manage categories,
-- events deletion, members and the join code.
-- The very first account becomes 'admin' (bootstrap).
-- =====================================================================

-- ---------- role helpers (security definer: bypass RLS on profiles) ----------
create or replace function public.my_role()
returns public.user_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('member', 'admin') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

-- ---------- profile bootstrap on sign-up ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
begin
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(new.email, 'Użytkownik'), '@', 1)
  );
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    left(v_name, 80),
    case when exists (select 1 from public.profiles) then 'guest' else 'admin' end::public.user_role
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- join code ----------
create or replace function public.join_club(p_code text)
returns public.user_role language plpgsql security definer set search_path = public as $$
declare
  v_role public.user_role;
begin
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.app_settings where upper(trim(join_code)) = upper(trim(coalesce(p_code, '')))
  ) then
    perform pg_sleep(0.5); -- cheap brute-force damper
    raise exception 'Nieprawidłowy kod koła' using errcode = 'P0001';
  end if;
  perform set_config('app.joining_club', 'on', true);
  update public.profiles set role = 'member' where id = auth.uid() and role = 'guest';
  select role into v_role from public.profiles where id = auth.uid();
  return v_role;
end $$;

-- ---------- users cannot escalate their own role ----------
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- join_club() promotes guest -> member (flag is transaction-local, not reachable via the API)
  if old.role = 'guest' and new.role = 'member' and current_setting('app.joining_club', true) = 'on' then
    return new;
  end if;
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Tylko administrator może zmieniać role' using errcode = '42501';
  end if;
  if new.role is distinct from old.role and old.id = auth.uid() and old.role = 'admin' then
    raise exception 'Nie możesz odebrać sobie uprawnień administratora' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------- drop the prototype "anon can do anything" policies ----------
do $$
declare
  r record;
begin
  for r in select tablename, policyname from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ---------- grants: nothing for anon ----------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon, public;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon, public;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- ---------- RLS ----------
alter table public.profiles     enable row level security;
alter table public.app_settings enable row level security;

-- inventory tables: members read + write
do $$
declare
  t text;
begin
  foreach t in array array['items', 'consumables', 'locations', 'event_consumables', 'shopping_list'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.is_member()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.is_member()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.is_member())) with check ((select public.is_member()))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.is_member()))', t || '_delete', t);
  end loop;
end $$;

-- categories & events: members read/insert/update, admins delete
do $$
declare
  t text;
begin
  foreach t in array array['categories', 'events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.is_member()))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.is_member()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.is_member())) with check ((select public.is_member()))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.is_admin()))', t || '_delete', t);
  end loop;
end $$;

-- the default category can never be removed (SKU fallback)
create or replace function public.protect_default_category()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.code = 'BK' then
    raise exception 'Kategorii domyślnej (BK) nie można usunąć ani zmienić jej kodu' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger categories_protect_delete before delete on public.categories
  for each row execute function public.protect_default_category();
create trigger categories_protect_code before update of code on public.categories
  for each row when (old.code = 'BK' and new.code is distinct from old.code)
  execute function public.protect_default_category();

-- profiles: everyone signed in sees themselves; members see everyone (for "responsible" pickers)
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_member()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_update_admin on public.profiles for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy profiles_delete_admin on public.profiles for delete to authenticated
  using ((select public.is_admin()) and id <> (select auth.uid()));

-- settings: admins only
create policy settings_admin_select on public.app_settings for select to authenticated using ((select public.is_admin()));
create policy settings_admin_update on public.app_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
