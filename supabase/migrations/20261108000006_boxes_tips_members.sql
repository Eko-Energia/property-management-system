-- =====================================================================
-- Event boxes get a physical location, onboarding tips are remembered
-- per profile, admins can remove accounts.
-- =====================================================================

-- ---------- where a box physically is (shelf, bus, trailer...) ----------
alter table public.locations
  add column stored_at_id bigint references public.locations (id) on delete set null,
  add constraint locations_stored_at_not_self check (stored_at_id is distinct from id);

create or replace function public.check_box_stored_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.stored_at_id is null then
    return new;
  end if;
  if new.kind <> 'event_box' then
    raise exception 'Miejsce przechowywania ustawia się tylko dla skrzyń' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.locations where id = new.stored_at_id and kind = 'permanent') then
    raise exception 'Skrzynia może stać tylko w stałym miejscu magazynu' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger locations_box_stored_at before insert or update of stored_at_id, kind on public.locations
  for each row execute function public.check_box_stored_at();

-- ---------- onboarding: which tutorials the user has already seen ----------
alter table public.profiles add column seen_tips text[] not null default '{}';

-- ---------- admin: remove an account completely ----------
-- Deleting auth.users cascades to profiles; responsible_id / requested_by /
-- activity_log.actor_id are "on delete set null", so history stays.
create or replace function public.remove_member(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Tylko administrator może usuwać konta' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Nie możesz usunąć własnego konta' using errcode = 'P0001';
  end if;
  delete from auth.users where id = p_user_id;
  if not found then
    raise exception 'Nie ma takiego konta' using errcode = 'P0002';
  end if;
end $$;

revoke execute on function public.remove_member(uuid) from anon, public;
grant execute on function public.remove_member(uuid) to authenticated;
revoke execute on function public.check_box_stored_at() from anon, public;
