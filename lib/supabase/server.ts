import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database.types';
import { env } from '@/lib/env';

/** Supabase client for route handlers / server code (reads + refreshes the cookie session). */
export async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient<Database>(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // called from a Server Component: proxy.ts refreshes the session instead
        }
      },
    },
  });
}
