// Fail loudly instead of silently falling back to fake data (the old "demo mode").
// NEXT_PUBLIC_* must be referenced literally so Next can inline them at build time.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Brak konfiguracji Supabase: ustaw NEXT_PUBLIC_SUPABASE_URL i NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (lub NEXT_PUBLIC_SUPABASE_ANON_KEY) w .env.local / Vercel.',
  );
}

export const env = { supabaseUrl, supabaseKey } as const;
