'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Copy, GraduationCap, KeyRound, Loader2, Lock, RefreshCw, Shield, Trash2, User, UserX, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useJoinCode } from '@/lib/data/queries';
import { useLookups } from '@/lib/data/lookups';
import { rpc, useUpdate } from '@/lib/data/mutations';
import { qk } from '@/lib/data/keys';
import { getSupabase } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { ROLE_LABEL } from '@/lib/format';
import type { Profile, UserRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Badge, Card, Mono, PageHeader } from '@/components/ui/misc';
import { useConfirm } from '@/components/ui/confirm';
import { cn } from '@/components/ui/cn';
import { TOUR_EVENT } from '@/components/onboarding';
import { useQueryClient } from '@tanstack/react-query';

function Section({ icon: Icon, title, description, children, action }: { icon: typeof User; title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-zinc-800 p-2 text-zinc-300">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-semibold text-zinc-100">{title}</h2>
            {description && <p className="text-sm text-zinc-500">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  return (
    <>
      <PageHeader title="Ustawienia" description={isAdmin ? 'Twoje konto, członkowie i dostęp do koła' : 'Twoje konto i członkowie koła'} />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <ProfileSection />
          {isAdmin && <JoinCodeSection />}
          <Link href="/magazyn?tab=miejsca" className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-400 hover:text-zinc-200">
            <span className="flex-1">
              Miejsca w magazynie i kategorie są teraz w zakładkach <span className="text-zinc-200">Magazynu</span>.
            </span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <MembersSection />
      </div>
    </>
  );
}

function ProfileSection() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState<string | null>(null);
  const update = useUpdate('profiles', { invalidate: [qk.me, qk.profiles], success: 'Zapisano' });
  if (!profile) return null;
  return (
    <Section icon={User} title="Twój profil" description={`Rola: ${ROLE_LABEL[profile.role]}`}>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (name?.trim()) await update.mutateAsync({ id: profile.id, values: { display_name: name.trim() } });
          setName(null);
          qc.invalidateQueries({ queryKey: qk.me });
        }}
      >
        <Input value={name ?? profile.display_name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="Imię i nazwisko" />
        <Button type="submit" disabled={name === null || !name.trim()} loading={update.isPending}>
          Zapisz
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/nowe-haslo" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-zinc-300 hover:bg-zinc-800">
          <Lock className="h-4 w-4" /> Ustaw / zmień hasło
        </Link>
        <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: profile.id, values: { seen_tips: [] } }, {
              onSuccess: async () => {
                await qc.invalidateQueries({ queryKey: qk.me });
                window.dispatchEvent(new Event(TOUR_EVENT));
              },
            })}>
          <GraduationCap className="h-4 w-4" /> Pokaż samouczek
        </Button>
      </div>
    </Section>
  );
}

function JoinCodeSection() {
  const code = useJoinCode(true);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const link = typeof window !== 'undefined' && code.data ? `${window.location.origin}/dolacz?kod=${code.data.join_code}` : '';

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success('Skopiowano');
  };

  const regenerate = async () => {
    setBusy(true);
    const next = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
    const { error } = await getSupabase().from('app_settings').update({ join_code: next }).eq('id', true);
    setBusy(false);
    if (error) toast.error(errorMessage(error));
    else {
      toast.success('Nowy kod aktywny, stary przestał działać');
      qc.invalidateQueries({ queryKey: qk.settings });
    }
  };

  return (
    <Section icon={KeyRound} title="Kod koła" description="Nowe osoby po założeniu konta wpisują ten kod i dostają dostęp. Wyślij link na grupę.">
      <div className="flex items-center gap-2">
        <Mono className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-center text-lg tracking-[0.3em] text-zinc-100">{code.data?.join_code ?? '······'}</Mono>
        <Button size="icon" onClick={() => code.data && copy(code.data.join_code)} aria-label="Kopiuj kod">
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={() => copy(link)} disabled={!link}>
          <Copy className="h-4 w-4" /> Kopiuj link zaproszenia
        </Button>
        <Button size="sm" variant="ghost" onClick={regenerate} loading={busy}>
          <RefreshCw className="h-4 w-4" /> Wygeneruj nowy
        </Button>
      </div>
    </Section>
  );
}

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'guest', label: 'Brak dostępu' },
  { value: 'member', label: 'Członek' },
  { value: 'admin', label: 'Admin' },
];

const ROLE_ACTIVE: Record<UserRole, string> = {
  guest: 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/40',
  member: 'bg-zinc-700 text-white ring-1 ring-zinc-500',
  admin: 'bg-blue-600/25 text-blue-100 ring-1 ring-blue-500/50',
};

function MembersSection() {
  const { isAdmin, profile: me } = useAuth();
  const lookups = useLookups();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [pending, setPending] = useState<{ id: string; role?: UserRole; removing?: boolean } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const groups: { title: string; rows: Profile[] }[] = [
    { title: 'Zarząd (admini)', rows: lookups.profiles.filter((p) => p.role === 'admin') },
    { title: 'Członkowie', rows: lookups.profiles.filter((p) => p.role === 'member') },
    { title: 'Bez dostępu (nie wpisali kodu albo odebrano dostęp)', rows: isAdmin ? lookups.profiles.filter((p) => p.role === 'guest') : [] },
  ].filter((g) => g.rows.length > 0);

  const highlight = (id: string) => {
    setFlash(id);
    window.setTimeout(() => setFlash((f) => (f === id ? null : f)), 1500);
  };

  const setRole = async (p: Profile, role: UserRole) => {
    if (role === p.role) return;
    if (
      role === 'admin' &&
      !(await confirm({ title: `Nadać ${p.display_name} rolę admina?`, description: 'Admin zarządza członkami i kodem koła, może usuwać wyjazdy i kategorie.', confirmLabel: 'Nadaj admina', tone: 'primary' }))
    )
      return;
    if (
      role === 'guest' &&
      !(await confirm({ title: `Odebrać dostęp ${p.display_name}?`, description: 'Konto zostaje, ale bez wglądu w magazyn. Dostęp przywrócisz jednym kliknięciem albo kodem koła.', confirmLabel: 'Odbierz dostęp' }))
    )
      return;
    setPending({ id: p.id, role });
    const { error } = await getSupabase().from('profiles').update({ role }).eq('id', p.id);
    setPending(null);
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    await qc.invalidateQueries({ queryKey: qk.profiles });
    highlight(p.id);
    toast.success(role === 'guest' ? `${p.display_name}: odebrano dostęp` : `${p.display_name} ma teraz rolę: ${ROLE_LABEL[role]}`);
  };

  const remove = async (p: Profile) => {
    const ok = await confirm({
      title: `Usunąć konto ${p.display_name}?`,
      description: 'Konto zostanie skasowane na stałe. Rzeczy pod jego/jej opieką zostaną bez opiekuna, historia zmian zostaje. Można potem założyć konto od nowa.',
      confirmLabel: 'Usuń konto',
    });
    if (!ok) return;
    setPending({ id: p.id, removing: true });
    try {
      await rpc('remove_member', { p_user_id: p.id });
      toast.success(`Usunięto konto ${p.display_name}`);
      await qc.invalidateQueries({ queryKey: qk.profiles });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPending(null);
    }
  };

  return (
    <Section
      icon={Users}
      title={`Członkowie (${lookups.profiles.filter((p) => p.role !== 'guest').length})`}
      description={isAdmin ? 'Zmień rolę jednym kliknięciem. Kosz usuwa konto na stałe.' : undefined}
    >
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.title}>
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{g.title}</h3>
            <ul className="divide-y divide-zinc-800/70">
              {g.rows.map((p) => {
                const editable = isAdmin && p.id !== me?.id;
                const busy = pending?.id === p.id;
                return (
                  <li key={p.id} className={cn('-mx-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl px-2 py-2 transition-colors duration-700', flash === p.id && 'bg-emerald-500/10')}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold uppercase text-zinc-300">{p.display_name.slice(0, 2)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                      {p.display_name} {p.id === me?.id && <span className="text-zinc-500">(Ty)</span>}
                    </span>
                    {editable ? (
                      <div className="flex w-full items-center gap-1 sm:w-auto">
                        <div role="radiogroup" aria-label={`Rola: ${p.display_name}`} className="flex flex-1 rounded-lg border border-zinc-800 bg-zinc-950 p-0.5 sm:flex-none">
                          {ROLE_OPTIONS.map((o) => {
                            const active = p.role === o.value;
                            const spinning = busy && pending?.role === o.value;
                            return (
                              <button
                                key={o.value}
                                role="radio"
                                aria-checked={active}
                                disabled={busy}
                                onClick={() => setRole(p, o.value)}
                                className={cn(
                                  'flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors sm:flex-none',
                                  active ? ROLE_ACTIVE[o.value] : 'text-zinc-500 hover:text-zinc-200',
                                )}
                              >
                                {spinning && <Loader2 className="h-3 w-3 animate-spin" />}
                                {!spinning && active && o.value === 'admin' && <Shield className="h-3 w-3" />}
                                {!spinning && active && o.value === 'guest' && <UserX className="h-3 w-3" />}
                                {o.label}
                              </button>
                            );
                          })}
                        </div>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => remove(p)}
                          loading={busy && pending?.removing}
                          disabled={busy}
                          aria-label={`Usuń konto ${p.display_name}`}
                          className="text-zinc-500 hover:text-red-300"
                        >
                          {!(busy && pending?.removing) && <Trash2 className="h-4 w-4" />}
                        </Button>
                      </div>
                    ) : (
                      <Badge tone={p.role === 'admin' ? 'info' : p.role === 'guest' ? 'warning' : 'neutral'}>
                        {p.role === 'admin' && <Shield className="h-3 w-3" />} {ROLE_LABEL[p.role]}
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
