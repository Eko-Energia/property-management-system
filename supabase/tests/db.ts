import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite, type Transaction } from '@electric-sql/pglite';

const root = join(__dirname, '..');

/** Fresh in-memory Postgres: Supabase stub -> prototype schema -> all migrations. */
export async function createDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(readFileSync(join(__dirname, 'supabase_stub.sql'), 'utf8'));
  await db.exec(readFileSync(join(__dirname, 'prototype_schema.sql'), 'utf8'));
  const migrationsDir = join(root, 'migrations');
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    try {
      await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
    } catch (err) {
      throw new Error(`Migration ${file} failed: ${(err as Error).message}`);
    }
  }
  return db;
}

/** Simulates Supabase Auth sign-up (fires the profile trigger). */
export async function signUp(db: PGlite, email: string, displayName: string): Promise<string> {
  const res = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [email, JSON.stringify({ display_name: displayName })],
  );
  return res.rows[0].id;
}

/** Runs fn as a signed-in user (role authenticated + JWT sub), like PostgREST does. */
export async function asUser<T>(db: PGlite, uid: string | null, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${uid ? 'authenticated' : 'anon'}`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? '']);
    return fn(tx);
  });
}

export async function joinCode(db: PGlite): Promise<string> {
  const res = await db.query<{ code: string }>(`select public.join_code_for(public.join_window()) as code`);
  return res.rows[0].code;
}
