import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, createDb, joinCode, signUp } from './db';

let db: PGlite;
let admin: string;
let member: string;

beforeAll(async () => {
  db = await createDb();
  admin = await signUp(db, 'admin@test.pl', 'Admin');
  member = await signUp(db, 'member@test.pl', 'Member');
  const code = await joinCode(db);
  await asUser(db, member, (tx) => tx.query(`select public.join_club($1)`, [code]));
}, 60_000);

describe('box stored_at', () => {
  it('boxes can stand in a permanent place, nothing else', async () => {
    const { shelf, box } = await asUser(db, member, async (tx) => {
      const shelf = (await tx.query<{ id: number }>(`insert into locations (name, kind) values ('Bus', 'permanent') returning id`)).rows[0].id;
      const box = (await tx.query<{ id: number }>(
        `insert into locations (name, kind, event_id, stored_at_id, responsible_id) values ('S1', 'event_box', 3, $1, $2) returning id`,
        [shelf, member],
      )).rows[0].id;
      return { shelf, box };
    });
    await expect(asUser(db, member, (tx) => tx.query(`update locations set stored_at_id = $1 where id = $2`, [box, shelf]))).rejects.toThrow(/tylko dla skrzyń/);
  });

  it('a box cannot stand inside another box', async () => {
    const a = await asUser(db, member, async (tx) => (await tx.query<{ id: number }>(`insert into locations (name, kind, event_id) values ('A', 'event_box', 3) returning id`)).rows[0].id);
    await expect(
      asUser(db, member, (tx) => tx.query(`insert into locations (name, kind, event_id, stored_at_id) values ('B', 'event_box', 3, $1)`, [a])),
    ).rejects.toThrow(/stałym miejscu/);
  });
});

describe('seen_tips', () => {
  it('users can mark their own tips as seen', async () => {
    const row = await asUser(db, member, (tx) =>
      tx.query<{ seen_tips: string[] }>(`update profiles set seen_tips = array['welcome'] where id = $1 returning seen_tips`, [member]),
    );
    expect(row.rows[0].seen_tips).toEqual(['welcome']);
  });
});

describe('remove_member', () => {
  it('members cannot remove accounts', async () => {
    await expect(asUser(db, member, (tx) => tx.query(`select public.remove_member($1)`, [admin]))).rejects.toThrow(/administrator/);
  });

  it('admin cannot remove self', async () => {
    await expect(asUser(db, admin, (tx) => tx.query(`select public.remove_member($1)`, [admin]))).rejects.toThrow(/własnego/);
  });

  it('admin removes an account; references are nulled, not deleted', async () => {
    const extra = await signUp(db, 'extra@test.pl', 'Extra');
    await db.query(`update locations set responsible_id = $1 where name = 'Bus'`, [extra]);
    await asUser(db, admin, (tx) => tx.query(`select public.remove_member($1)`, [extra]));
    expect((await db.query(`select 1 from auth.users where id = $1`, [extra])).rows).toHaveLength(0);
    expect((await db.query(`select 1 from profiles where id = $1`, [extra])).rows).toHaveLength(0);
    const bus = await db.query<{ responsible_id: string | null }>(`select responsible_id from locations where name = 'Bus'`);
    expect(bus.rows[0].responsible_id).toBeNull();
  });
});
