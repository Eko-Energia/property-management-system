-- =====================================================================
-- No emails: the club code rotates every 15 minutes and doubles as the
-- "forgot password" key.
--  * code = first 6 hex chars of md5(secret : window), window = 15 min,
--    so no cron job is needed; the previous window stays valid as grace
--  * every member sees the current code (to let a friend in or help them
--    reset a password), admins can rotate the secret to kill old codes
--  * reset_password_with_code(): anon-callable, admins are excluded so a
--    member who knows the code cannot take over an admin account
--  * club_admins(): names of admins, shown on login/join screens
-- =====================================================================

alter table public.app_settings drop column join_code;
alter table public.app_settings add column join_secret text not null default md5(gen_random_uuid()::text || clock_timestamp()::text);

-- ---------- internal helpers (not callable through the API) ----------
create or replace function public.join_window(p_at timestamptz default now())
returns bigint language sql stable set search_path = public as $$
  select floor(extract(epoch from p_at) / 900)::bigint
$$;

create or replace function public.join_code_for(p_window bigint)
returns text language sql stable security definer set search_path = public as $$
  select upper(substr(md5(join_secret || ':' || p_window), 1, 6)) from public.app_settings
$$;

create or replace function public.check_join_code(p_code text)
returns boolean language sql stable security definer set search_path = public as $$
  select upper(trim(coalesce(p_code, ''))) in (
    public.join_code_for(public.join_window()),
    public.join_code_for(public.join_window() - 1)
  )
$$;

revoke execute on function public.join_window(timestamptz) from anon, authenticated, public;
revoke execute on function public.join_code_for(bigint) from anon, authenticated, public;
revoke execute on function public.check_join_code(text) from anon, authenticated, public;

-- ---------- members: current code + when it changes ----------
create or replace function public.current_join_code()
returns table (code text, expires_at timestamptz) language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_member() then
    raise exception 'Kod koła widzą tylko członkowie' using errcode = '42501';
  end if;
  return query select
    public.join_code_for(public.join_window()),
    to_timestamp((public.join_window() + 1) * 900);
end $$;

create or replace function public.regenerate_join_code()
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Tylko administrator może unieważnić kod' using errcode = '42501';
  end if;
  update public.app_settings set join_secret = md5(gen_random_uuid()::text || clock_timestamp()::text);
end $$;

-- ---------- join with the rotating code ----------
create or replace function public.join_club(p_code text)
returns public.user_role language plpgsql security definer set search_path = public as $$
declare
  v_role public.user_role;
begin
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany' using errcode = '42501';
  end if;
  if not public.check_join_code(p_code) then
    perform pg_sleep(0.5); -- cheap brute-force damper
    raise exception 'Nieprawidłowy albo wygasły kod koła' using errcode = 'P0001';
  end if;
  perform set_config('app.joining_club', 'on', true);
  update public.profiles set role = 'member' where id = auth.uid() and role = 'guest';
  select role into v_role from public.profiles where id = auth.uid();
  return v_role;
end $$;

-- ---------- forgot password without email ----------
create or replace function public.reset_password_with_code(p_email text, p_code text, p_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id   uuid;
  v_role public.user_role;
begin
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'Hasło musi mieć co najmniej 6 znaków' using errcode = 'P0001';
  end if;
  if not public.check_join_code(p_code) then
    perform pg_sleep(0.5);
    raise exception 'Nieprawidłowy albo wygasły kod koła' using errcode = 'P0001';
  end if;
  select u.id, p.role into v_id, v_role
  from auth.users u left join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(coalesce(p_email, '')));
  if v_id is null then
    raise exception 'Nie ma konta z tym adresem email' using errcode = 'P0002';
  end if;
  if v_role = 'admin' then
    raise exception 'Hasła admina nie można zresetować kodem. Zaloguj się przez Google albo poproś innego admina.' using errcode = '42501';
  end if;
  update auth.users
  set encrypted_password = crypt(p_password, gen_salt('bf')),
      updated_at = now()
  where id = v_id;
end $$;

-- ---------- who to ask for the code ----------
create or replace function public.club_admins()
returns setof text language sql stable security definer set search_path = public as $$
  select display_name from public.profiles where role = 'admin' order by created_at
$$;

grant execute on function public.current_join_code() to authenticated;
grant execute on function public.regenerate_join_code() to authenticated;
grant execute on function public.join_club(text) to authenticated;
grant execute on function public.reset_password_with_code(text, text, text) to anon, authenticated;
grant execute on function public.club_admins() to anon, authenticated;
