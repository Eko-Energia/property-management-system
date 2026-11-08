'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Boxes, Home, Loader2, LogOut, Plane, Settings, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useStats } from '@/lib/data/queries';
import { GlobalScanButton } from '@/components/global-scan';
import { Onboarding } from '@/components/onboarding';
import { cn } from '@/components/ui/cn';
import { ErrorState } from '@/components/ui/misc';

const NAV = [
  { href: '/', label: 'Start', icon: Home },
  { href: '/magazyn', label: 'Magazyn', icon: Boxes },
  { href: '/zawody', label: 'Wyjazdy', icon: Plane },
  { href: '/zakupy', label: 'Zakupy', icon: ShoppingCart },
];

const BARE_ROUTES = ['/login', '/dolacz', '/auth', '/nowe-haslo'];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, profileError, retryProfile, loading, isMember, isAdmin, signOut } = useAuth();
  const stats = useStats(isMember);
  const bare = BARE_ROUTES.some((r) => pathname.startsWith(r));

  // signed in but not yet in the club -> join screen
  useEffect(() => {
    if (loading || bare) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (profile && !isMember) {
      router.replace(`/dolacz?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, profile, isMember, bare, pathname, router]);

  if (bare) return <main className="min-h-dvh">{children}</main>;

  if (!loading && user && profileError) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-3 text-center">
          <ErrorState error={profileError} onRetry={retryProfile} />
          <button onClick={signOut} className="text-sm text-zinc-400 underline underline-offset-2 hover:text-zinc-200">
            Wyloguj się
          </button>
        </div>
      </div>
    );
  }

  if (loading || !isMember) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const badge = (href: string) => {
    if (!stats.data) return 0;
    if (href === '/zakupy') return stats.data.open_purchases;
    return 0;
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-zinc-50">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
              <Boxes className="h-4 w-4" />
            </span>
            <span className="hidden sm:inline">Eko-Energia</span>
            <span className="text-zinc-500 sm:hidden">PMS</span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'relative flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive(pathname, href) ? 'bg-zinc-800 text-zinc-50' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                {badge(href) > 0 && <span className="rounded-md bg-amber-500/20 px-1.5 text-[11px] text-amber-300">{badge(href)}</span>}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <div className="hidden md:block">
              <GlobalScanButton variant="header" />
            </div>
            <Link
              href="/ustawienia"
              className={cn(
                'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100',
                isActive(pathname, '/ustawienia') && 'bg-zinc-800 text-zinc-50',
              )}
              title="Ustawienia"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold uppercase text-zinc-200">
                {profile?.display_name.slice(0, 2)}
              </span>
              <span className="hidden max-w-32 truncate lg:inline">{profile?.display_name}</span>
              {isAdmin && <Settings className="hidden h-4 w-4 lg:inline" />}
            </Link>
            <button onClick={signOut} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200" title="Wyloguj">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-5 sm:px-6 md:pb-10">{children}</main>

      {/* mobile bottom bar: thumb-reachable, scan in the middle */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-950/95 pb-safe backdrop-blur-md md:hidden">
        <div className="grid grid-cols-5 items-end">
          {NAV.slice(0, 2).map((n) => (
            <BottomLink key={n.href} {...n} active={isActive(pathname, n.href)} badge={badge(n.href)} />
          ))}
          <div className="flex justify-center">
            <GlobalScanButton variant="fab" />
          </div>
          {NAV.slice(2).map((n) => (
            <BottomLink key={n.href} {...n} active={isActive(pathname, n.href)} badge={badge(n.href)} />
          ))}
        </div>
      </nav>
      <Onboarding />
    </div>
  );
}

function BottomLink({ href, label, icon: Icon, active, badge }: { href: string; label: string; icon: typeof Home; active: boolean; badge: number }) {
  return (
    <Link href={href} className={cn('relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', active ? 'text-zinc-50' : 'text-zinc-500')}>
      <Icon className={cn('h-5 w-5', active && 'text-blue-400')} />
      {label}
      {badge > 0 && (
        <span className="absolute right-[calc(50%-18px)] top-1.5 min-w-4 rounded-full bg-amber-500 px-1 text-center text-[10px] font-semibold leading-4 text-zinc-950">
          {badge}
        </span>
      )}
    </Link>
  );
}
