import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/database.types';
import { env } from '@/lib/env';

const PUBLIC_PATHS = ['/login', '/auth'];

/**
 * Refreshes the Supabase session cookie on every request and sends
 * signed-out users to /login (keeping the target, e.g. a scanned QR link).
 * Authorisation itself is enforced by RLS in the database, not here.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!signedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    if (pathname !== '/') url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }
  if (signedIn && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = request.nextUrl.searchParams.get('next') ?? '/';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon|manifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)'],
};
