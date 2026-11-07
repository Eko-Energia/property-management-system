-- =====================================================================
-- Domain logic in Postgres: every multi-step or counter operation is a
-- single atomic RPC. Functions run as SECURITY INVOKER, so RLS still
-- applies; each one also checks membership up front for a clear error.
-- app.action (set_config) is picked up by the audit trigger as context.
-- =====================================================================

create or replace function public.require_member()
returns void language plpgsql stable set search_path = public as $$
begin
  if not public.is_member() then
    raise exception 'Brak uprawnień: dołącz do koła kodem, aby edytować dane' using errcode = '42501';
  end if;
end $$;

-- ---------- SKU ----------
-- Format: <I|C>-<CATEGORY CODE>-<0001>. Generated in the DB under an
-- advisory lock, so concurrent inserts never collide.
create or replace function public.next_sku(p_kind text, p_category_id bigint)
returns text language plpgsql volatile set search_path = public as $$
declare
  v_code   text;
  v_prefix text;
  v_max    int;
begin
  if p_kind not in ('I', 'C') then
    raise exception 'Nieznany typ SKU: %', p_kind;
  end if;
  select code into v_code from public.categories where id = p_category_id;
  v_prefix := p_kind || '-' || coalesce(upper(v_code), 'BK') || '-';
  perform pg_advisory_xact_lock(hashtext('sku:' || v_prefix));
  if p_kind = 'I' then
    select max(substring(sku from length(v_prefix) + 1)::int) into v_max
    from public.items
    where sku like v_prefix || '%' and substring(sku from length(v_prefix) + 1) ~ '^\d{1,9}$';
  else
    select max(substring(sku from length(v_prefix) + 1)::int) into v_max
    from public.consumables
    where sku like v_prefix || '%' and substring(sku from length(v_prefix) + 1) ~ '^\d{1,9}$';
  end if;
  return v_prefix || lpad((coalesce(v_max, 0) + 1)::text, 4, '0');
end $$;

-- assign SKU on insert; re-assign when the category changes
create or replace function public.assign_sku()
returns trigger language plpgsql set search_path = public as $$
declare
  v_kind text := case when tg_table_name = 'items' then 'I' else 'C' end;
begin
  if new.category_id is null then
    select id into new.category_id from public.categories where code = 'BK';
  end if;
  if tg_op = 'INSERT' then
    if new.sku is null or trim(new.sku) = '' then
      new.sku := public.next_sku(v_kind, new.category_id);
    end if;
  elsif new.category_id is distinct from old.category_id and new.sku = old.sku then
    new.sku := public.next_sku(v_kind, new.category_id);
  end if;
  return new;
end $$;

create trigger items_assign_sku before insert or update of category_id on public.items
  for each row execute function public.assign_sku();
create trigger consumables_assign_sku before insert or update of category_id on public.consumables
  for each row execute function public.assign_sku();

-- ---------- scanner / QR lookup (parameterised: no filter injection) ----------
create or replace function public.lookup_code(p_code text)
returns table (
  kind        text,
  id          bigint,
  sku         text,
  name        text,
  barcode     text,
  item_status public.item_status,
  location_id bigint,
  event_id    bigint
) language sql stable set search_path = public as $$
  select 'item', i.id, i.sku, i.name, i.barcode, i.status, i.location_id, l.event_id
  from public.items i
  left join public.locations l on l.id = i.location_id
  where i.barcode = trim(p_code) or upper(i.sku) = upper(trim(p_code))
  union all
  select 'consumable', c.id, c.sku, c.name, c.barcode, null, c.location_id, null
  from public.consumables c
  where c.barcode = trim(p_code) or upper(c.sku) = upper(trim(p_code))
  limit 5
$$;

-- move a physical label from wherever it is to the target record
create or replace function public.assign_label(p_code text, p_kind text, p_id bigint)
returns void language plpgsql set search_path = public as $$
declare
  v_code text := nullif(trim(p_code), '');
begin
  perform public.require_member();
  perform set_config('app.action', 'label_assign', true);
  if v_code is null then
    raise exception 'Pusty kod etykiety';
  end if;
  update public.items set barcode = null where barcode = v_code and not (p_kind = 'item' and id = p_id);
  update public.consumables set barcode = null where barcode = v_code and not (p_kind = 'consumable' and id = p_id);
  if p_kind = 'item' then
    update public.items set barcode = v_code where id = p_id;
  else
    update public.consumables set barcode = v_code where id = p_id;
  end if;
  if not found then
    raise exception 'Nie znaleziono rekordu docelowego';
  end if;
end $$;

-- ---------- warehouse stock ----------
create or replace function public.adjust_stock(p_consumable_id bigint, p_delta int)
returns public.consumables language plpgsql set search_path = public as $$
declare
  r public.consumables;
begin
  perform public.require_member();
  perform set_config('app.action', 'stock_adjust', true);
  update public.consumables
     set quantity_stored = quantity_stored + p_delta
   where id = p_consumable_id and quantity_stored + p_delta >= 0
  returning * into r;
  if not found then
    if not exists (select 1 from public.consumables where id = p_consumable_id) then
      raise exception 'Materiał nie istnieje' using errcode = 'P0002';
    end if;
    raise exception 'Stan nie może być ujemny' using errcode = 'P0001';
  end if;
  return r;
end $$;

-- ---------- automation: low stock -> shopping list, restocked -> cancel auto request ----------
create or replace function public.auto_restock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.min_quantity > 0 and new.quantity_stored < new.min_quantity then
    insert into public.shopping_list (name, kind, quantity, shop_link, category_id, consumable_id, is_auto, status)
    values (new.name, 'consumable', greatest(new.min_quantity * 2 - new.quantity_stored, 1),
            new.shop_link, new.category_id, new.id, true, 'pending')
    on conflict (consumable_id) where status in ('pending', 'ordered') and consumable_id is not null
    do nothing;
  elsif new.quantity_stored >= new.min_quantity then
    update public.shopping_list
       set status = 'cancelled'
     where consumable_id = new.id and is_auto and status = 'pending';
  end if;
  return new;
end $$;

create trigger consumables_auto_restock
  after insert or update of quantity_stored, min_quantity on public.consumables
  for each row execute function public.auto_restock();

-- ---------- events: items ----------
-- keep the item's permanent "home" so it can go back where it came from
create or replace function public.move_item_to_box(p_item_id bigint, p_box_id bigint, p_status public.item_status, p_force boolean default false)
returns public.items language plpgsql set search_path = public as $$
declare
  v_item   public.items;
  v_box    public.locations;
  v_cur    public.locations;
  v_event  public.events;
begin
  perform public.require_member();
  select * into v_item from public.items where id = p_item_id for update;
  if not found then raise exception 'Przedmiot nie istnieje' using errcode = 'P0002'; end if;
  select * into v_box from public.locations where id = p_box_id;
  if not found or v_box.kind <> 'event_box' then raise exception 'Wybierz skrzynię wyjazdową'; end if;
  select * into v_event from public.events where id = v_box.event_id;
  if v_event.status = 'closed' then raise exception 'Wyjazd „%” jest zamknięty', v_event.name; end if;
  select * into v_cur from public.locations where id = v_item.location_id;

  if not p_force and v_cur.kind = 'event_box' and v_cur.event_id <> v_box.event_id
     and v_item.status in ('assigned_to_event', 'packed') then
    raise exception 'Przedmiot jest już przypisany do innego wyjazdu (%)',
      (select name from public.events where id = v_cur.event_id) using errcode = 'P0003';
  end if;

  perform set_config('app.action', case when p_status = 'packed' then 'item_pack' else 'item_assign' end, true);
  update public.items set
    status = p_status,
    location_id = p_box_id,
    home_location_id = case when v_cur.kind = 'permanent' then v_cur.id else home_location_id end
  where id = p_item_id
  returning * into v_item;
  return v_item;
end $$;

create or replace function public.unpack_item(p_item_id bigint)
returns public.items language plpgsql set search_path = public as $$
declare
  r public.items;
begin
  perform public.require_member();
  perform set_config('app.action', 'item_unpack', true);
  update public.items set status = 'assigned_to_event'
  where id = p_item_id and status = 'packed'
  returning * into r;
  if not found then raise exception 'Przedmiot nie jest spakowany'; end if;
  return r;
end $$;

create or replace function public.return_item(p_item_id bigint, p_location_id bigint default null)
returns public.items language plpgsql set search_path = public as $$
declare
  r public.items;
begin
  perform public.require_member();
  perform set_config('app.action', 'item_return', true);
  update public.items set
    status = 'in_workshop',
    location_id = coalesce(p_location_id, home_location_id,
                  case when (select kind from public.locations where id = location_id) = 'permanent' then location_id end)
  where id = p_item_id
  returning * into r;
  if not found then raise exception 'Przedmiot nie istnieje' using errcode = 'P0002'; end if;
  return r;
end $$;

create or replace function public.mark_item(p_item_id bigint, p_status public.item_status)
returns public.items language plpgsql set search_path = public as $$
declare
  r public.items;
begin
  perform public.require_member();
  if p_status not in ('missing', 'broken') then
    raise exception 'Użyj dedykowanej akcji dla statusu %', p_status;
  end if;
  perform set_config('app.action', 'item_mark_' || p_status, true);
  update public.items set status = p_status where id = p_item_id returning * into r;
  if not found then raise exception 'Przedmiot nie istnieje' using errcode = 'P0002'; end if;
  return r;
end $$;

-- ---------- events: consumables ----------
-- add demand for a consumable in a box (or raise it) and optionally pack right away
create or replace function public.pack_consumable_into_box(p_box_id bigint, p_consumable_id bigint, p_qty int, p_required int default null)
returns public.event_consumables language plpgsql set search_path = public as $$
declare
  v_ec public.event_consumables;
begin
  perform public.require_member();
  if p_qty < 0 then raise exception 'Ilość nie może być ujemna'; end if;
  if (select kind from public.locations where id = p_box_id) is distinct from 'event_box' then
    raise exception 'Wybierz skrzynię wyjazdową';
  end if;
  insert into public.event_consumables (box_id, consumable_id, quantity_required, quantity_packed)
  values (p_box_id, p_consumable_id, greatest(coalesce(p_required, p_qty), 0), 0)
  on conflict (box_id, consumable_id) do update
    set quantity_required = greatest(public.event_consumables.quantity_required,
                                     coalesce(p_required, public.event_consumables.quantity_packed + p_qty))
  returning * into v_ec;
  if p_qty > 0 then
    v_ec := public.pack_consumable(v_ec.id, p_qty);
  end if;
  return v_ec;
end $$;

-- move n units between warehouse and a box; negative delta = unpack back to warehouse
create or replace function public.pack_consumable(p_ec_id bigint, p_delta int)
returns public.event_consumables language plpgsql set search_path = public as $$
declare
  v_ec    public.event_consumables;
  v_avail int;
begin
  perform public.require_member();
  select * into v_ec from public.event_consumables where id = p_ec_id for update;
  if not found then raise exception 'Pozycja nie istnieje' using errcode = 'P0002'; end if;
  if v_ec.quantity_returned is not null then raise exception 'Pozycja została już rozliczona po wyjeździe'; end if;
  if p_delta = 0 then return v_ec; end if;
  if exists (select 1 from public.locations l join public.events e on e.id = l.event_id
             where l.id = v_ec.box_id and e.status = 'closed') then
    raise exception 'Wyjazd jest zamknięty';
  end if;

  perform set_config('app.action', case when p_delta > 0 then 'consumable_pack' else 'consumable_unpack' end, true);
  if p_delta > 0 then
    update public.consumables set quantity_stored = quantity_stored - p_delta
    where id = v_ec.consumable_id and quantity_stored >= p_delta;
    if not found then
      select quantity_stored into v_avail from public.consumables where id = v_ec.consumable_id;
      raise exception 'Za mało w magazynie (dostępne: %)', coalesce(v_avail, 0) using errcode = 'P0001';
    end if;
  else
    if v_ec.quantity_packed + p_delta < 0 then
      raise exception 'Nie można rozpakować więcej niż spakowano (%)', v_ec.quantity_packed;
    end if;
    update public.consumables set quantity_stored = quantity_stored - p_delta where id = v_ec.consumable_id;
  end if;

  update public.event_consumables set quantity_packed = quantity_packed + p_delta
  where id = p_ec_id returning * into v_ec;
  return v_ec;
end $$;

-- after the event: what came back goes to the warehouse, the rest counts as used
create or replace function public.return_event_consumable(p_ec_id bigint, p_returned int)
returns public.event_consumables language plpgsql set search_path = public as $$
declare
  v_ec public.event_consumables;
begin
  perform public.require_member();
  select * into v_ec from public.event_consumables where id = p_ec_id for update;
  if not found then raise exception 'Pozycja nie istnieje' using errcode = 'P0002'; end if;
  if v_ec.quantity_returned is not null then raise exception 'Pozycja została już rozliczona'; end if;
  if p_returned < 0 or p_returned > v_ec.quantity_packed then
    raise exception 'Zwrot musi być w zakresie 0–%', v_ec.quantity_packed;
  end if;
  perform set_config('app.action', 'consumable_return', true);
  update public.consumables set quantity_stored = quantity_stored + p_returned where id = v_ec.consumable_id;
  update public.event_consumables set quantity_returned = p_returned where id = p_ec_id returning * into v_ec;
  return v_ec;
end $$;

-- delete a box without losing stock: packed consumables go back, items go home
create or replace function public.delete_box(p_box_id bigint)
returns void language plpgsql set search_path = public as $$
declare
  v_ec record;
begin
  perform public.require_member();
  if (select kind from public.locations where id = p_box_id) is distinct from 'event_box' then
    raise exception 'To nie jest skrzynia wyjazdowa';
  end if;
  perform set_config('app.action', 'box_delete', true);
  for v_ec in select * from public.event_consumables where box_id = p_box_id and quantity_returned is null loop
    update public.consumables set quantity_stored = quantity_stored + v_ec.quantity_packed where id = v_ec.consumable_id;
  end loop;
  update public.items set status = 'in_workshop', location_id = home_location_id
  where location_id = p_box_id and status in ('assigned_to_event', 'packed');
  update public.items set location_id = home_location_id where location_id = p_box_id;
  delete from public.locations where id = p_box_id;
end $$;

create or replace function public.delete_event(p_event_id bigint)
returns void language plpgsql set search_path = public as $$
declare
  v_box bigint;
begin
  if not public.is_admin() then
    raise exception 'Tylko administrator może usuwać wyjazdy' using errcode = '42501';
  end if;
  for v_box in select id from public.locations where event_id = p_event_id loop
    perform public.delete_box(v_box);
  end loop;
  perform set_config('app.action', 'event_delete', true);
  delete from public.events where id = p_event_id;
end $$;

-- close an event. With p_auto_return everything still open is returned in full.
create or replace function public.close_event(p_event_id bigint, p_auto_return boolean default false)
returns public.events language plpgsql set search_path = public as $$
declare
  v_open_items int;
  v_open_cons  int;
  v_ec         record;
  r            public.events;
begin
  perform public.require_member();
  if p_auto_return then
    update public.items i set status = 'in_workshop', location_id = coalesce(i.home_location_id, i.location_id)
    from public.locations l
    where l.id = i.location_id and l.event_id = p_event_id and i.status in ('assigned_to_event', 'packed');
    for v_ec in
      select ec.id, ec.quantity_packed from public.event_consumables ec
      join public.locations l on l.id = ec.box_id
      where l.event_id = p_event_id and ec.quantity_returned is null
    loop
      perform public.return_event_consumable(v_ec.id, v_ec.quantity_packed);
    end loop;
  end if;

  select count(*) into v_open_items from public.items i join public.locations l on l.id = i.location_id
  where l.event_id = p_event_id and i.status in ('assigned_to_event', 'packed');
  select count(*) into v_open_cons from public.event_consumables ec join public.locations l on l.id = ec.box_id
  where l.event_id = p_event_id and ec.quantity_returned is null and ec.quantity_packed > 0;
  if v_open_items > 0 or v_open_cons > 0 then
    raise exception 'Nierozliczone: % przedmiotów i % materiałów. Rozlicz je albo użyj „Zwróć wszystko i zamknij”.',
      v_open_items, v_open_cons using errcode = 'P0001';
  end if;

  perform set_config('app.action', 'event_close', true);
  update public.events set status = 'closed', closed_at = now() where id = p_event_id returning * into r;
  return r;
end $$;

-- ---------- shopping list ----------
create or replace function public.receive_purchase(
  p_id bigint,
  p_consumable_id bigint default null,
  p_location_id bigint default null,
  p_category_id bigint default null
) returns public.shopping_list language plpgsql set search_path = public as $$
declare
  s        public.shopping_list;
  v_target bigint;
begin
  perform public.require_member();
  select * into s from public.shopping_list where id = p_id for update;
  if not found then raise exception 'Zgłoszenie nie istnieje' using errcode = 'P0002'; end if;
  if s.status in ('received', 'cancelled') then raise exception 'Zgłoszenie jest już zamknięte'; end if;
  perform set_config('app.action', 'purchase_receive', true);

  if s.kind = 'consumable' then
    v_target := coalesce(p_consumable_id, s.consumable_id);
    if v_target is not null then
      update public.consumables set quantity_stored = quantity_stored + s.quantity where id = v_target;
      if not found then raise exception 'Wskazany materiał nie istnieje'; end if;
    else
      insert into public.consumables (name, quantity_stored, category_id, location_id, shop_link)
      values (s.name, s.quantity, coalesce(p_category_id, s.category_id), p_location_id, s.shop_link)
      returning id into v_target;
    end if;
  else
    -- one statement per row: each SKU trigger must see the previous insert
    for i in 1 .. s.quantity loop
      insert into public.items (name, category_id, location_id, home_location_id, shop_link, status)
      values (s.name, coalesce(p_category_id, s.category_id), p_location_id, p_location_id, s.shop_link, 'in_workshop');
    end loop;
  end if;

  update public.shopping_list
     set status = 'received', received_at = now(), consumable_id = coalesce(v_target, consumable_id)
   where id = p_id
  returning * into s;
  return s;
end $$;

create or replace function public.stamp_shopping_status()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'ordered' and old.status is distinct from 'ordered' then
    new.ordered_at := now();
  end if;
  if tg_op = 'INSERT' and new.requested_by is null and not new.is_auto then
    new.requested_by := auth.uid();
  end if;
  return new;
end $$;
create trigger shopping_stamp before insert or update of status on public.shopping_list
  for each row execute function public.stamp_shopping_status();

-- ---------- dashboard stats in one round trip ----------
create or replace function public.dashboard_stats()
returns json language sql stable set search_path = public as $$
  select json_build_object(
    'items',          (select count(*) from public.items),
    'items_out',      (select count(*) from public.items where status in ('assigned_to_event', 'packed')),
    'items_problem',  (select count(*) from public.items where status in ('missing', 'broken')),
    'consumables',    (select count(*) from public.consumables),
    'low_stock',      (select count(*) from public.consumables where min_quantity > 0 and quantity_stored < min_quantity),
    'active_events',  (select count(*) from public.events where status <> 'closed'),
    'open_purchases', (select count(*) from public.shopping_list where status in ('pending', 'ordered')),
    'purchases_cost', (select coalesce(sum(price_estimate * quantity), 0) from public.shopping_list where status in ('pending', 'ordered'))
  )
$$;
