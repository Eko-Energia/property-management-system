import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite, Transaction } from '@electric-sql/pglite';
import { asUser, createDb, joinCode, signUp } from './db';

let db: PGlite;
let admin: string;
let member: string;
let guest: string;

const one = async <T>(tx: Transaction | PGlite, sql: string, params: unknown[] = []) =>
  (await tx.query<T>(sql, params)).rows[0];

beforeAll(async () => {
  db = await createDb();
  admin = await signUp(db, 'admin@test.pl', 'Admin');
  member = await signUp(db, 'member@test.pl', 'Member');
  guest = await signUp(db, 'guest@test.pl', 'Guest');
  const code = await joinCode(db);
  await asUser(db, member, (tx) => tx.query(`select public.join_club($1)`, [code.toLowerCase()]));
}, 60_000);

describe('data migration', () => {
  it('keeps prototype rows with new keys', async () => {
    const item = await one<{ sku: string; status: string; shop_link: string | null }>(
      db, `select sku, status, shop_link from items`);
    expect(item).toEqual({ sku: 'I-BK-0001', status: 'in_workshop', shop_link: null });
    expect((await db.query(`select * from consumables`)).rows).toHaveLength(3);
    const ev = await one<{ status: string }>(db, `select status from events where id = 3`);
    expect(ev.status).toBe('active');
  });

  it('drops orphaned event_consumables', async () => {
    expect((await db.query(`select * from event_consumables`)).rows).toHaveLength(0);
  });
});

describe('auth & RLS', () => {
  it('first user is admin, later users are guests until they join', async () => {
    const roles = await db.query<{ display_name: string; role: string }>(
      `select display_name, role from profiles order by created_at, display_name`);
    expect(Object.fromEntries(roles.rows.map((r) => [r.display_name, r.role]))).toEqual({
      Admin: 'admin', Member: 'member', Guest: 'guest',
    });
  });

  it('anon has no access at all', async () => {
    await expect(asUser(db, null, (tx) => tx.query(`select * from items`))).rejects.toThrow(/permission denied/);
  });

  it('guest sees nothing and cannot write', async () => {
    const rows = await asUser(db, guest, (tx) => tx.query(`select * from items`));
    expect(rows.rows).toHaveLength(0);
    await expect(asUser(db, guest, (tx) => tx.query(`insert into items (name) values ('x')`)))
      .rejects.toThrow(/row-level security/);
    await expect(asUser(db, guest, (tx) => tx.query(`select public.adjust_stock(1, 1)`)))
      .rejects.toThrow(/Brak uprawnień/);
  });

  it('wrong join code is rejected', async () => {
    await expect(asUser(db, guest, (tx) => tx.query(`select public.join_club('nope')`)))
      .rejects.toThrow(/Nieprawidłowy kod/);
  });

  it('members cannot escalate their role, admins can change roles', async () => {
    await expect(asUser(db, member, (tx) => tx.query(`update profiles set role = 'admin' where id = $1`, [member])))
      .rejects.toThrow(/Tylko administrator/);
    await asUser(db, member, (tx) => tx.query(`update profiles set display_name = 'Mem' where id = $1`, [member]));
    const settings = await asUser(db, member, (tx) => tx.query(`select * from app_settings`));
    expect(settings.rows).toHaveLength(0);
    const adminSettings = await asUser(db, admin, (tx) => tx.query(`select * from app_settings`));
    expect(adminSettings.rows).toHaveLength(1);
  });
});

describe('SKU & labels', () => {
  it('generates sequential SKUs per category and re-generates on category change', async () => {
    const res = await asUser(db, member, async (tx) => {
      const cat = await one<{ id: number }>(tx, `insert into categories (name, code) values ('Elektronika', 'EL') returning id`);
      const a = await one<{ id: number; sku: string }>(tx, `insert into items (name, category_id) values ('Multimetr', $1) returning id, sku`, [cat.id]);
      const b = await one<{ sku: string }>(tx, `insert into items (name, category_id) values ('Oscyloskop', $1) returning sku`, [cat.id]);
      const c = await one<{ sku: string }>(tx, `insert into items (name) values ('Bez kat') returning sku`);
      const moved = await one<{ sku: string }>(tx, `update items set category_id = (select id from categories where code = 'BK') where id = $1 returning sku`, [a.id]);
      const cons = await one<{ sku: string }>(tx, `insert into consumables (name, category_id) values ('Cyna', $1) returning sku`, [cat.id]);
      return { a: a.sku, b: b.sku, c: c.sku, moved: moved.sku, cons: cons.sku };
    });
    expect(res).toEqual({ a: 'I-EL-0001', b: 'I-EL-0002', c: 'I-BK-0002', moved: 'I-BK-0003', cons: 'C-EL-0001' });
  });

  it('a label can belong to only one record across items and consumables', async () => {
    await asUser(db, member, (tx) => tx.query(`update items set barcode = '00045' where sku = 'I-EL-0002'`));
    await expect(asUser(db, member, (tx) => tx.query(`update consumables set barcode = '00045' where sku = 'C-EL-0001'`)))
      .rejects.toThrow(/już przypisana do sprzętu/);
    await asUser(db, member, (tx) => tx.query(`select public.assign_label('00045', 'consumable', (select id from consumables where sku = 'C-EL-0001'))`));
    const r = await one<{ i: string | null; c: string | null }>(db,
      `select (select barcode from items where sku = 'I-EL-0002') i, (select barcode from consumables where sku = 'C-EL-0001') c`);
    expect(r).toEqual({ i: null, c: '00045' });
  });

  it('lookup_code is parameterised and case-insensitive for SKU', async () => {
    const hit = await asUser(db, member, (tx) => tx.query<{ kind: string; sku: string }>(`select kind, sku from public.lookup_code('i-el-0002')`));
    expect(hit.rows).toEqual([{ kind: 'item', sku: 'I-EL-0002' }]);
    const label = await asUser(db, member, (tx) => tx.query<{ kind: string }>(`select kind from public.lookup_code(' 00045 ')`));
    expect(label.rows).toEqual([{ kind: 'consumable' }]);
    const evil = await asUser(db, member, (tx) => tx.query(`select * from public.lookup_code('x,id.neq.0)')`));
    expect(evil.rows).toHaveLength(0);
  });
});

describe('stock & automation', () => {
  it('adjust_stock is atomic and never negative', async () => {
    const id = (await one<{ id: number }>(db, `select id from consumables where sku = 'C-SR-0002'`)).id;
    await asUser(db, member, (tx) => tx.query(`select public.adjust_stock($1, -6)`, [id]));
    await expect(asUser(db, member, (tx) => tx.query(`select public.adjust_stock($1, -999)`, [id])))
      .rejects.toThrow(/ujemny/);
    expect((await one<{ q: number }>(db, `select quantity_stored q from consumables where id = $1`, [id])).q).toBe(30);
  });

  it('low stock creates one auto purchase request, restock cancels it', async () => {
    const id = (await one<{ id: number }>(db, `select id from consumables where sku = 'C-SR-0003'`)).id; // 10 / min 5
    await asUser(db, member, (tx) => tx.query(`select public.adjust_stock($1, -7)`, [id])); // 3
    await asUser(db, member, (tx) => tx.query(`select public.adjust_stock($1, -1)`, [id])); // 2
    const open = await db.query<{ quantity: number; is_auto: boolean }>(
      `select quantity, is_auto from shopping_list where consumable_id = $1 and status = 'pending'`, [id]);
    expect(open.rows).toEqual([{ quantity: 7, is_auto: true }]);
    await asUser(db, member, (tx) => tx.query(`select public.adjust_stock($1, 10)`, [id]));
    const after = await one<{ status: string }>(db, `select status from shopping_list where consumable_id = $1`, [id]);
    expect(after.status).toBe('cancelled');
  });
});

describe('event lifecycle', () => {
  let eventId: number;
  let boxId: number;
  let itemId: number;
  let consId: number;

  beforeAll(async () => {
    await asUser(db, member, async (tx) => {
      eventId = (await one<{ id: number }>(tx, `insert into events (name, status) values ('Shell Eco', 'active') returning id`)).id;
      boxId = (await one<{ id: number }>(tx, `insert into locations (name, kind, event_id) values ('Skrzynia 1', 'event_box', $1) returning id`, [eventId])).id;
      itemId = (await one<{ id: number }>(tx, `update items set location_id = 12 where sku = 'I-EL-0002' returning id`)).id;
      consId = (await one<{ id: number }>(tx, `select id from consumables where sku = 'C-SR-0002'`)).id; // 30
    });
  });

  it('packing an item remembers its home location', async () => {
    const r = await asUser(db, member, (tx) => one<{ status: string; location_id: number; home_location_id: number }>(
      tx, `select status, location_id, home_location_id from public.move_item_to_box($1, $2, 'packed')`, [itemId, boxId]));
    expect(r).toEqual({ status: 'packed', location_id: boxId, home_location_id: 12 });
  });

  it('packing consumables moves stock atomically and refuses overdraw', async () => {
    const ec = await asUser(db, member, (tx) => one<{ id: number; quantity_packed: number; quantity_required: number }>(
      tx, `select id, quantity_packed, quantity_required from public.pack_consumable_into_box($1, $2, 8, 10)`, [boxId, consId]));
    expect(ec).toMatchObject({ quantity_packed: 8, quantity_required: 10 });
    expect((await one<{ q: number }>(db, `select quantity_stored q from consumables where id = $1`, [consId])).q).toBe(22);
    await expect(asUser(db, member, (tx) => tx.query(`select public.pack_consumable($1, 100)`, [ec.id])))
      .rejects.toThrow(/Za mało w magazynie \(dostępne: 22\)/);
    await asUser(db, member, (tx) => tx.query(`select public.pack_consumable($1, -2)`, [ec.id]));
    expect((await one<{ q: number }>(db, `select quantity_stored q from consumables where id = $1`, [consId])).q).toBe(24);
  });

  it('closing with open positions fails, auto-return closes and restores stock', async () => {
    await expect(asUser(db, member, (tx) => tx.query(`select public.close_event($1)`, [eventId])))
      .rejects.toThrow(/Nierozliczone: 1 przedmiotów i 1 materiałów/);
    await asUser(db, member, (tx) => tx.query(`select public.close_event($1, true)`, [eventId]));
    const item = await one<{ status: string; location_id: number }>(db, `select status, location_id from items where id = $1`, [itemId]);
    expect(item).toEqual({ status: 'in_workshop', location_id: 12 });
    expect((await one<{ q: number }>(db, `select quantity_stored q from consumables where id = $1`, [consId])).q).toBe(30);
    expect((await one<{ s: string }>(db, `select status s from events where id = $1`, [eventId])).s).toBe('closed');
    await expect(asUser(db, member, (tx) => tx.query(`select public.move_item_to_box($1, $2, 'packed')`, [itemId, boxId])))
      .rejects.toThrow(/zamknięty/);
  });

  it('deleting a box returns packed stock and items', async () => {
    const r = await asUser(db, member, async (tx) => {
      const ev = (await one<{ id: number }>(tx, `insert into events (name) values ('Droniada') returning id`)).id;
      const box = (await one<{ id: number }>(tx, `insert into locations (name, kind, event_id) values ('B', 'event_box', $1) returning id`, [ev])).id;
      await tx.query(`select public.move_item_to_box($1, $2, 'assigned_to_event')`, [itemId, box]);
      await tx.query(`select public.pack_consumable_into_box($1, $2, 5)`, [box, consId]);
      await tx.query(`select public.delete_box($1)`, [box]);
      return one<{ q: number; st: string; loc: number }>(tx,
        `select (select quantity_stored from consumables where id = $1) q, (select status::text from items where id = $2) st, (select location_id from items where id = $2) loc`,
        [consId, itemId]);
    });
    expect(r).toEqual({ q: 30, st: 'in_workshop', loc: 12 });
  });

  it('only admins delete events', async () => {
    const ev = await asUser(db, member, (tx) => one<{ id: number }>(tx, `insert into events (name) values ('Tmp') returning id`));
    await expect(asUser(db, member, (tx) => tx.query(`select public.delete_event($1)`, [ev.id]))).rejects.toThrow(/administrator/);
    await asUser(db, admin, (tx) => tx.query(`select public.delete_event($1)`, [ev.id]));
    expect((await db.query(`select 1 from events where id = $1`, [ev.id])).rows).toHaveLength(0);
  });
});

describe('purchases', () => {
  it('receiving creates N items with unique SKUs and closes the request once', async () => {
    const req = await asUser(db, member, (tx) => one<{ id: number; requested_by: string }>(tx,
      `insert into shopping_list (name, kind, quantity, category_id) values ('Lutownica', 'item', 3, (select id from categories where code = 'EL')) returning id, requested_by`));
    expect(req.requested_by).toBe(member);
    await asUser(db, member, (tx) => tx.query(`select public.receive_purchase($1, null, 12)`, [req.id]));
    const skus = await db.query<{ sku: string }>(`select sku from items where name = 'Lutownica' order by sku`);
    expect(skus.rows.map((r) => r.sku)).toEqual(['I-EL-0003', 'I-EL-0004', 'I-EL-0005']);
    await expect(asUser(db, member, (tx) => tx.query(`select public.receive_purchase($1)`, [req.id])))
      .rejects.toThrow(/już zamknięte/);
  });

  it('receiving a consumable restocks the linked record', async () => {
    const id = (await one<{ id: number }>(db, `select id from consumables where sku = 'C-SR-0001'`)).id; // 10
    const req = await asUser(db, member, (tx) => one<{ id: number }>(tx,
      `insert into shopping_list (name, kind, quantity, consumable_id) values ('Cyna', 'consumable', 15, $1) returning id`, [id]));
    await asUser(db, member, (tx) => tx.query(`select public.receive_purchase($1)`, [req.id]));
    expect((await one<{ q: number }>(db, `select quantity_stored q from consumables where id = $1`, [id])).q).toBe(25);
  });
});

describe('activity log', () => {
  it('records actor and action context', async () => {
    const rows = await asUser(db, member, (tx) => tx.query<{ actor_id: string; context: string }>(
      `select actor_id, context from activity_log where context = 'item_pack'`));
    expect(rows.rows.length).toBeGreaterThan(0);
    expect(rows.rows[0].actor_id).toBe(member);
    await expect(asUser(db, member, (tx) => tx.query(`delete from activity_log`))).rejects.toThrow(/permission denied/);
  });

  it('default category cannot be deleted', async () => {
    await expect(asUser(db, admin, (tx) => tx.query(`delete from categories where code = 'BK'`))).rejects.toThrow(/domyślnej/);
  });
});
