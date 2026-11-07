-- =====================================================================
-- Self-healing profiles: accounts created before the on_auth_user_created
-- trigger existed (or while it was broken) have no profile row and the app
-- cannot tell what role they have. ensure_profile() creates the missing row
-- for the caller using the same rules as handle_new_user().
-- =====================================================================

create or replace function public.ensure_profile()
returns public.profiles language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles;
  v_user    auth.users;
  v_name    text;
begin
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if found then
    return v_profile;
  end if;

  select * into v_user from auth.users where id = auth.uid();
  v_name := coalesce(
    nullif(trim(v_user.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(v_user.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(v_user.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(v_user.email, 'Użytkownik'), '@', 1)
  );

  -- serialize so two concurrent first sign-ins cannot both become admin
  perform pg_advisory_xact_lock(hashtext('public.ensure_profile'));
  insert into public.profiles (id, display_name, role)
  values (
    auth.uid(),
    left(v_name, 80),
    case when exists (select 1 from public.profiles) then 'guest' else 'admin' end::public.user_role
  )
  on conflict (id) do nothing;

  select * into v_profile from public.profiles where id = auth.uid();
  return v_profile;
end $$;

revoke execute on function public.ensure_profile() from anon, public;
grant execute on function public.ensure_profile() to authenticated;

-- backfill accounts that already exist without a profile
-- (oldest account becomes admin if there is no profile at all yet)
insert into public.profiles (id, display_name, role)
select
  u.id,
  left(coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    split_part(coalesce(u.email, 'Użytkownik'), '@', 1)
  ), 80),
  case
    when not exists (select 1 from public.profiles)
         and u.id = (select id from auth.users order by created_at limit 1)
    then 'admin' else 'guest'
  end::public.user_role
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
