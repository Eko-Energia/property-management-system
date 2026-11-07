import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';
import { env } from '@/lib/env';

let client: SupabaseClient<Database> | undefined;

/** Browser Supabase client (singleton). Session lives in cookies, shared with proxy.ts. */
export function getSupabase(): SupabaseClient<Database> {
  client ??= createBrowserClient<Database>(env.supabaseUrl, env.supabaseKey);
  return client;
}
