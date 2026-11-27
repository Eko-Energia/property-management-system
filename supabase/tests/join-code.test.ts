import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { asUser, createDb, joinCode, signUp } from './db';

let db: PGlite;
let admin: string;
let member: string;

const codeFor = async (offset: number) =>
  (await db.query<{ code: string }>(`select public.join_code_for(public.join_window() + $1) as code`, [offset])).rows[0].code;
const anon = <T>(sql: string, params: unknown[] = []) => asUser(db, null, (tx) => tx.query<T>(sql, params));
const password = async (uid: string) =>
  (await db.query<{ encrypted_password: string | null }>(`select encrypted_password from auth.users where id = $1`, [uid])).rows[0].encrypted_password;

beforeAll(async () => {
  db = await createDb();
  admin = await signUp(db, 'admin@test.pl', 'Szef');
  member = await signUp(db, 'Member@Test.pl', 'Member');
  const code = await joinCode(db);
  await asUser(db, member, (tx) => tx.query(`select public.join_club($1)`, [code]));
}, 60_000);

describe('rotating join code', () => {
  it('members see the current code with its expiry, guests do not', async () => {
    const row = await asUser(db, member, (tx) => tx.query<{ code: string; expires_at: Date }>(`select * from public.current_join_code()`));
    const expected = await joinCode(db);
    expect(row.rows[0].code).toBe(expected);
    expect(row.rows[0].code).toMatch(/^[0-9A-F]{6}$/);
    expect(new Date(row.rows[0].expires_at).getTime()).toBeGreaterThan(Date.now());
    const guest = await signUp(db, 'g@test.pl', 'Guest');
    await expect(asUser(db, guest, (tx) => tx.query(`select * from public.current_join_code()`))).rejects.toThrow(/członkowie/);
  });

  it('previous window is accepted, older ones are not', async () => {
    const late = await signUp(db, 'late@test.pl', 'Late');
    const older = await signUp(db, 'older@test.pl', 'Older');
    const prev = await codeFor(-1);
    const old = await codeFor(-2);
    await asUser(db, late, (tx) => tx.query(`select public.join_club($1)`, [prev.toLowerCase()]));
    await expect(asUser(db, older, (tx) => tx.query(`select public.join_club($1)`, [old]))).rejects.toThrow(/wygasły/);
  });

  it('internal helpers are not exposed', async () => {
    await expect(asUser(db, member, (tx) => tx.query(`select public.join_code_for(1)`))).rejects.toThrow();
    await expect(anon(`select public.check_join_code('x')`)).rejects.toThrow();
  });

  it('only admins rotate the secret, which kills the current code', async () => {
    await expect(asUser(db, member, (tx) => tx.query(`select public.regenerate_join_code()`))).rejects.toThrow(/administrator/);
    const before = await joinCode(db);
    await asUser(db, admin, (tx) => tx.query(`select public.regenerate_join_code()`));
    expect(await joinCode(db)).not.toBe(before);
  });
});

describe('reset_password_with_code', () => {
  it('anon resets a member password with the current code (email is case-insensitive)', async () => {
    const code = await joinCode(db);
    await anon(`select public.reset_password_with_code($1, $2, $3)`, [' member@test.PL ', code, 'nowehaslo']);
    const { h } = (await db.query<{ h: string }>(`select md5('nowehaslo') h`)).rows[0];
    expect(await password(member)).toBe('$fake$' + h);
  });

  it('rejects a wrong code, short password and unknown email', async () => {
    const code = await joinCode(db);
    await expect(anon(`select public.reset_password_with_code('member@test.pl', 'ZZZZZZ', 'nowehaslo')`)).rejects.toThrow(/kod koła/);
    await expect(anon(`select public.reset_password_with_code('member@test.pl', $1, '123')`, [code])).rejects.toThrow(/6 znaków/);
    await expect(anon(`select public.reset_password_with_code('nobody@test.pl', $1, 'nowehaslo')`, [code])).rejects.toThrow(/Nie ma konta/);
  });

  it('admin passwords cannot be reset with the code', async () => {
    const code = await joinCode(db);
    await expect(anon(`select public.reset_password_with_code('admin@test.pl', $1, 'przejete')`, [code])).rejects.toThrow(/admina/);
    expect(await password(admin)).toBeNull();
  });
});

describe('club_admins', () => {
  it('anyone (also signed out) sees admin names', async () => {
    const res = await anon<{ club_admins: string }>(`select public.club_admins()`);
    expect(res.rows.map((r) => r.club_admins)).toEqual(['Szef']);
  });
});

describe('advisor fixes (0008)', () => {
  it('signed-out users cannot call members-only RPCs', async () => {
    await expect(anon(`select * from public.current_join_code()`)).rejects.toThrow(/permission denied/);
    await expect(anon(`select public.regenerate_join_code()`)).rejects.toThrow(/permission denied/);
  });

  it('trigger functions are not executable through the API, triggers still fire', async () => {
    const res = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_proc p
       where p.pronamespace = 'public'::regnamespace and p.prorettype = 'trigger'::regtype
         and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))`,
    );
    expect(res.rows[0].n).toBe(0);
    // touch_updated_at + audit_row fire for a signed-in member
    await asUser(db, member, (tx) => tx.query(`update profiles set display_name = 'Member2' where id = $1`, [member]));
    const p = await db.query<{ display_name: string }>(`select display_name from profiles where id = $1`, [member]);
    expect(p.rows[0].display_name).toBe('Member2');
  });

  it('single update policy: self yes, other member no, admin yes', async () => {
    const other = await signUp(db, 'other@test.pl', 'Other');
    const r1 = await asUser(db, member, (tx) => tx.query(`update profiles set display_name = 'Hack' where id = $1 returning id`, [other]));
    expect(r1.rows).toHaveLength(0);
    const r2 = await asUser(db, admin, (tx) => tx.query(`update profiles set display_name = 'Fixed' where id = $1 returning id`, [other]));
    expect(r2.rows).toHaveLength(1);
  });
});
