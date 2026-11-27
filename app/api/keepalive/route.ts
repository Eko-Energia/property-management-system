import { NextResponse, type NextRequest } from 'next/server';

/**
 * Daily ping from Vercel Cron (vercel.json) so the free Supabase project is
 * never idle for 7 days and does not get paused. It runs one real query
 * (club_admins RPC, callable without signing in) through the public API.
 * A project that is already paused is NOT woken up by this; restore it in the dashboard.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Vercel sends "Authorization: Bearer $CRON_SECRET" when the env var is set
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // read env at request time (lib/env throws on import, which would break the build without env)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, error: 'missing Supabase env' }, { status: 500 });

  const started = Date.now();
  const res = await fetch(`${url}/rest/v1/rpc/club_admins`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: '{}',
    cache: 'no-store',
  });
  const body = { ok: res.ok, status: res.status, ms: Date.now() - started, at: new Date().toISOString() };
  if (!res.ok) console.error('keepalive failed', body, await res.text());
  return NextResponse.json(body, { status: res.ok ? 200 : 502 });
}
