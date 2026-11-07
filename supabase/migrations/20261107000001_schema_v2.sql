-- =====================================================================
-- Schema v2: stable surrogate keys, enums, constraints, timestamps.
-- Written against the prototype schema created by hand in the dashboard
-- (text SKU primary keys, free-text responsible_person, no constraints).
-- Existing rows are preserved; orphaned event_consumables rows are dropped.
-- =====================================================================

-- ---------- helpers: prototype constraint names are not stable ----------
-- (prod tables were recreated by hand: items_pkey1, items_location_id_fkey1, ...)
create function pg_temp.drop_pk(p_table regclass) returns void language plpgsql as $$
declare v_name text;
begin
  select conname into strict v_name from pg_constraint where conrelid = p_table and contype = 'p';
  execute format('alter table %s drop constraint %I', p_table, v_name);
end $$;

create function pg_temp.drop_fks(p_table regclass, p_column text) returns void language plpgsql as $$
declare v_name text;
begin
  for v_name in
    select c.conname from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
    where c.conrelid = p_table and c.contype = 'f' and a.attname = p_column
  loop
    execute format('alter table %s drop constraint %I', p_table, v_name);
  end loop;
end $$;

-- ---------- enums ----------
create type public.user_role       as enum ('guest', 'member', 'admin');
create type public.item_status     as enum ('in_workshop', 'assigned_to_event', 'packed', 'missing', 'broken');
create type public.location_kind   as enum ('permanent', 'event_box');
create type public.event_status    as enum ('planning', 'active', 'closed');
create type public.shopping_kind   as enum ('item', 'consumable');
create type public.shopping_status as enum ('pending', 'ordered', 'received', 'cancelled');

-- ---------- profiles (1:1 with auth.users) ----------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  role         public.user_role not null default 'guest',
  created_at   timestamptz not null default now()
);

-- ---------- singleton settings ----------
create table public.app_settings (
  id        boolean primary key default true check (id),
  join_code text not null check (length(trim(join_code)) >= 4)
);
insert into public.app_settings (join_code)
values (upper(substr(md5(gen_random_uuid()::text), 1, 6)));

-- ---------- generic updated_at ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- categories ----------
update public.categories set code = upper(trim(code));
alter table public.categories
  add constraint categories_code_format check (code ~ '^[A-Z0-9]{2,4}$'),
  add constraint categories_name_len check (length(trim(name)) between 1 and 60);
insert into public.categories (name, code) values ('Bez kategorii', 'BK')
on conflict (code) do nothing;

-- ---------- events ----------
alter table public.events add column status public.event_status not null default 'planning';
update public.events set status = case when is_active then 'active' else 'closed' end::public.event_status;
alter table public.events
  drop column is_active,
  add column end_date   date,
  add column place      text,
  add column notes      text,
  add column created_at timestamptz not null default now(),
  add column closed_at  timestamptz,
  alter column name set not null,
  alter column start_date set not null,
  alter column start_date set default current_date,
  add constraint events_name_len check (length(trim(name)) between 1 and 120),
  add constraint events_dates check (end_date is null or end_date >= start_date);

-- ---------- locations (permanent places + event boxes) ----------
alter table public.locations rename column type to kind_text;
alter table public.locations add column kind public.location_kind;
update public.locations set kind = case when kind_text = 'event_box' then 'event_box' else 'permanent' end::public.location_kind;
-- a box without an event is meaningless; turn it into a permanent place
update public.locations set kind = 'permanent' where kind = 'event_box' and event_id is null;
update public.locations set event_id = null where kind = 'permanent';
alter table public.locations
  drop column kind_text,
  drop column responsible_person,
  add column responsible_id uuid references public.profiles (id) on delete set null,
  add column created_at timestamptz not null default now(),
  alter column kind set not null,
  alter column name set not null,
  add constraint locations_name_len check (length(trim(name)) between 1 and 80),
  add constraint locations_kind_event check ((kind = 'event_box') = (event_id is not null));
select pg_temp.drop_fks('public.locations', 'event_id');
alter table public.locations add constraint locations_event_id_fkey
  foreign key (event_id) references public.events (id) on delete cascade;

-- ---------- items: SKU becomes a normal column, id becomes bigint ----------
alter table public.items rename column id to sku;
select pg_temp.drop_pk('public.items');
alter table public.items add column id bigint generated by default as identity primary key;
update public.items set
  shop_link = nullif(trim(shop_link), ''),
  barcode   = nullif(trim(barcode), ''),
  status    = coalesce(nullif(status, ''), 'in_workshop');
update public.items set status = 'in_workshop'
where status not in ('in_workshop', 'assigned_to_event', 'packed', 'missing', 'broken');
alter table public.items
  alter column status drop default,
  alter column status type public.item_status using status::public.item_status,
  alter column status set default 'in_workshop',
  alter column status set not null,
  alter column sku set not null,
  alter column name set not null,
  drop column responsible_person,
  add column responsible_id   uuid references public.profiles (id) on delete set null,
  add column home_location_id bigint references public.locations (id) on delete set null,
  add column notes            text,
  add column created_at       timestamptz not null default now(),
  add column updated_at       timestamptz not null default now(),
  add constraint items_sku_key unique (sku),
  add constraint items_name_len check (length(trim(name)) between 1 and 120),
  add constraint items_link_format check (shop_link is null or shop_link ~* '^https?://'),
  add constraint items_barcode_len check (barcode is null or length(barcode) between 1 and 64);
create trigger items_touch before update on public.items
  for each row execute function public.touch_updated_at();

-- ---------- consumables ----------
select pg_temp.drop_fks('public.event_consumables', 'consumable_id');
alter table public.event_consumables rename column consumable_id to consumable_sku;

alter table public.consumables rename column id to sku;
select pg_temp.drop_pk('public.consumables');
alter table public.consumables add column id bigint generated by default as identity primary key;
update public.consumables set
  shop_link = nullif(trim(shop_link), ''),
  barcode   = nullif(trim(barcode), ''),
  quantity_stored = greatest(coalesce(quantity_stored, 0), 0),
  min_quantity    = greatest(coalesce(min_quantity, 0), 0);
alter table public.consumables
  alter column quantity_stored type integer,
  alter column quantity_stored set default 0,
  alter column quantity_stored set not null,
  alter column min_quantity type integer,
  alter column min_quantity set default 0,
  alter column min_quantity set not null,
  alter column sku set not null,
  alter column name set not null,
  drop column responsible_person,
  add column responsible_id uuid references public.profiles (id) on delete set null,
  add column unit       text not null default 'szt.',
  add column notes      text,
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now(),
  add constraint consumables_sku_key unique (sku),
  add constraint consumables_qty_nonneg check (quantity_stored >= 0),
  add constraint consumables_min_nonneg check (min_quantity >= 0),
  add constraint consumables_name_len check (length(trim(name)) between 1 and 120),
  add constraint consumables_link_format check (shop_link is null or shop_link ~* '^https?://'),
  add constraint consumables_barcode_len check (barcode is null or length(barcode) between 1 and 64);
create trigger consumables_touch before update on public.consumables
  for each row execute function public.touch_updated_at();

-- ---------- event_consumables: per box demand + packing ----------
alter table public.event_consumables add column consumable_id bigint;
update public.event_consumables ec set consumable_id = c.id
from public.consumables c where c.sku = ec.consumable_sku;
delete from public.event_consumables where consumable_id is null or location_id is null;
select pg_temp.drop_fks('public.event_consumables', 'location_id');
alter table public.event_consumables rename column location_id to box_id;
alter table public.event_consumables
  drop column consumable_sku,
  drop column responsible_person,
  alter column consumable_id set not null,
  alter column box_id set not null,
  alter column quantity_packed type integer,
  alter column quantity_packed set default 0,
  alter column quantity_required type integer,
  alter column quantity_required set default 1,
  add column quantity_returned integer,
  add column created_at timestamptz not null default now(),
  add constraint event_consumables_consumable_fk foreign key (consumable_id) references public.consumables (id) on delete cascade,
  add constraint event_consumables_box_fk foreign key (box_id) references public.locations (id) on delete cascade,
  add constraint event_consumables_unique unique (box_id, consumable_id),
  add constraint event_consumables_qty check (quantity_packed >= 0 and quantity_required >= 0),
  add constraint event_consumables_returned check (quantity_returned is null or (quantity_returned >= 0 and quantity_returned <= quantity_packed));

-- ---------- shopping list ----------
alter table public.shopping_list rename column type to kind_text;
alter table public.shopping_list rename column status to status_text;
alter table public.shopping_list
  add column kind   public.shopping_kind,
  add column status public.shopping_status;
update public.shopping_list set
  kind = kind_text::public.shopping_kind,
  status = status_text::public.shopping_status,
  shop_link = nullif(trim(shop_link), '');
alter table public.shopping_list
  drop column kind_text,
  drop column status_text,
  drop column suggested_by,
  alter column kind set not null,
  alter column status set not null,
  alter column status set default 'pending',
  alter column name set not null,
  alter column quantity type integer,
  alter column quantity set not null,
  alter column price_estimate type numeric(10, 2),
  add column consumable_id bigint references public.consumables (id) on delete set null,
  add column requested_by  uuid references public.profiles (id) on delete set null,
  add column is_auto       boolean not null default false,
  add column notes         text,
  add column created_at    timestamptz not null default now(),
  add column ordered_at    timestamptz,
  add column received_at   timestamptz,
  add constraint shopping_qty_pos check (quantity > 0),
  add constraint shopping_price_nonneg check (price_estimate is null or price_estimate >= 0),
  add constraint shopping_name_len check (length(trim(name)) between 1 and 120),
  add constraint shopping_link_format check (shop_link is null or shop_link ~* '^https?://');
-- one open request per consumable (makes auto-restock idempotent)
create unique index shopping_open_per_consumable on public.shopping_list (consumable_id)
  where status in ('pending', 'ordered') and consumable_id is not null;

-- ---------- barcode = physical label, unique across items AND consumables ----------
create or replace function public.ensure_barcode_unique()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.barcode is null then
    return new;
  end if;
  new.barcode := trim(new.barcode);
  if tg_table_name = 'items' then
    if exists (select 1 from public.consumables where barcode = new.barcode) then
      raise exception 'Etykieta % jest już przypisana do materiału', new.barcode using errcode = '23505';
    end if;
  else
    if exists (select 1 from public.items where barcode = new.barcode) then
      raise exception 'Etykieta % jest już przypisana do sprzętu', new.barcode using errcode = '23505';
    end if;
  end if;
  return new;
end $$;
create trigger items_barcode_unique before insert or update of barcode on public.items
  for each row execute function public.ensure_barcode_unique();
create trigger consumables_barcode_unique before insert or update of barcode on public.consumables
  for each row execute function public.ensure_barcode_unique();

-- ---------- indexes ----------
create index items_location_idx      on public.items (location_id);
create index items_category_idx      on public.items (category_id);
create index items_status_idx        on public.items (status);
create index consumables_category_idx on public.consumables (category_id);
create index locations_event_idx     on public.locations (event_id);
create index ec_consumable_idx       on public.event_consumables (consumable_id);
create index shopping_status_idx     on public.shopping_list (status);
drop index if exists public.idx_items_barcode;
drop index if exists public.idx_consumables_barcode;
