import { NextResponse, type NextRequest } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

/** OAuth (Google) and email-link sign-ins land here: exchange the code for a session cookie. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next');
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (code) {
    const supabase = await getServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${target}`);
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
