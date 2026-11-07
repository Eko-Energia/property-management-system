import { describe, expect, it } from 'vitest';
import { asUser, createDb } from './db';

/** Accounts created while the sign-up trigger did not exist yet. */
async function signUpWithoutTrigger(db: Awaited<ReturnType<typeof createDb>>, email: string, name: string) {
  await db.exec('alter table auth.users disable trigger on_auth_user_created');
  const res = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [email, JSON.stringify({ full_name: name })],
  );
  await db.exec('alter table auth.users enable trigger on_auth_user_created');
  return res.rows[0].id;
}

describe('ensure_profile', () => {
  it('creates a missing profile; the first one becomes admin, later ones guests', async () => {
    const db = await createDb();
    const first = await signUpWithoutTrigger(db, 'first@test.pl', 'Pierwszy');
    const second = await signUpWithoutTrigger(db, 'second@test.pl', 'Drugi');

    const p1 = await asUser(db, first, (tx) => tx.query<{ role: string; display_name: string }>('select * from public.ensure_profile()'));
    expect(p1.rows[0]).toMatchObject({ role: 'admin', display_name: 'Pierwszy' });

    const p2 = await asUser(db, second, (tx) => tx.query<{ role: string }>('select * from public.ensure_profile()'));
    expect(p2.rows[0].role).toBe('guest');

    // idempotent: calling again returns the same row
    const again = await asUser(db, first, (tx) => tx.query<{ role: string }>('select * from public.ensure_profile()'));
    expect(again.rows[0].role).toBe('admin');
  });

  it('anon cannot call it', async () => {
    const db = await createDb();
    await expect(asUser(db, null, (tx) => tx.query('select public.ensure_profile()'))).rejects.toThrow();
  });
});
