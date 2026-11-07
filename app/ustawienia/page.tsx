'use client';

import { useState } from 'react';
import { Check, Copy, KeyRound, MapPin, Pencil, Plus, RefreshCw, Shield, Tags, Trash2, User, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { useConsumables, useItems, useJoinCode } from '@/lib/data/queries';
import { useLookups } from '@/lib/data/lookups';
import { useDelete, useInsert, useUpdate } from '@/lib/data/mutations';
import { qk } from '@/lib/data/keys';
import { getSupabase } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { ROLE_LABEL } from '@/lib/format';
import type { Category, Location, UserRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { Badge, Card, Mono, PageHeader } from '@/components/ui/misc';
import { useConfirm } from '@/components/ui/confirm';
import { PersonSelect } from '@/components/inventory/pickers';
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
      <PageHeader title="Ustawienia" description={isAdmin ? 'Twoje konto oraz konfiguracja koła' : 'Twoje konto i słowniki magazynu'} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileSection />
        {isAdmin && <JoinCodeSection />}
        <LocationsSection />
        <CategoriesSection />
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

function MembersSection() {
  const { isAdmin, profile: me } = useAuth();
  const lookups = useLookups();
  const update = useUpdate('profiles', { invalidate: [qk.profiles], success: 'Zmieniono rolę' });

  return (
    <Section icon={Users} title={`Członkowie (${lookups.profiles.filter((p) => p.role !== 'guest').length})`} description={isAdmin ? 'Admin: zarząd. „Brak dostępu” odbiera prawo do danych.' : undefined}>
      <ul className="divide-y divide-zinc-800/70">
        {lookups.profiles.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold uppercase text-zinc-300">{p.display_name.slice(0, 2)}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
              {p.display_name} {p.id === me?.id && <span className="text-zinc-500">(Ty)</span>}
            </span>
            {isAdmin && p.id !== me?.id ? (
              <>
                <Select value={p.role} onChange={(e) => update.mutate({ id: p.id, values: { role: e.target.value as UserRole } })} className="h-8 w-36 text-xs" aria-label="Rola">
                  <option value="guest">Brak dostępu</option>
                  <option value="member">{ROLE_LABEL.member}</option>
                  <option value="admin">{ROLE_LABEL.admin}</option>
                </Select>

              </>
            ) : (
              <Badge tone={p.role === 'admin' ? 'info' : p.role === 'guest' ? 'warning' : 'neutral'}>
                {p.role === 'admin' && <Shield className="h-3 w-3" />} {ROLE_LABEL[p.role]}
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function CategoriesSection() {
  const { isAdmin } = useAuth();
  const lookups = useLookups();
  const items = useItems();
  const consumables = useConsumables();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<{ id?: number; name: string; code: string } | null>(null);
  const insert = useInsert('categories', { invalidate: [qk.categories], success: 'Dodano kategorię' });
  const update = useUpdate('categories', { invalidate: [qk.categories, qk.items, qk.consumables], success: 'Zapisano' });
  const remove = useDelete('categories', { invalidate: [qk.categories, qk.items, qk.consumables], success: 'Usunięto kategorię' });

  const usage = (c: Category) => (items.data ?? []).filter((i) => i.category_id === c.id).length + (consumables.data ?? []).filter((x) => x.category_id === c.id).length;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const values = { name: draft.name.trim(), code: draft.code.trim().toUpperCase() };
    if (draft.id) await update.mutateAsync({ id: draft.id, values });
    else await insert.mutateAsync(values);
    setDraft(null);
  };

  return (
    <Section
      icon={Tags}
      title="Kategorie"
      description="Kod kategorii tworzy prefiks SKU (np. EL → I-EL-0001)."
      action={
        <Button size="sm" variant="ghost" onClick={() => setDraft({ name: '', code: '' })}>
          <Plus className="h-4 w-4" /> Dodaj
        </Button>
      }
    >
      {draft && (
        <form onSubmit={save} className="mb-3 flex gap-2">
          <Input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nazwa, np. Elektronika" maxLength={60} required />
          <Input
            value={draft.code}
            onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) })}
            placeholder="KOD"
            className="w-24 text-center font-mono"
            required
            minLength={2}
            disabled={draft.code === 'BK' && Boolean(draft.id)}
          />
          <Button type="submit" size="icon" variant="primary" aria-label="Zapisz" loading={insert.isPending || update.isPending}>
            <Check className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => setDraft(null)} aria-label="Anuluj">
            <X className="h-4 w-4" />
          </Button>
        </form>
      )}
      <ul className="divide-y divide-zinc-800/70">
        {lookups.categories.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-2">
            <Mono className="w-12 text-zinc-300">{c.code}</Mono>
            <span className="flex-1 text-sm text-zinc-200">{c.name}</span>
            <span className="text-xs text-zinc-500">{usage(c)} poz.</span>
            <Button size="icon-sm" variant="ghost" onClick={() => setDraft({ id: c.id, name: c.name, code: c.code })} aria-label="Edytuj">
              <Pencil className="h-4 w-4" />
            </Button>
            {isAdmin && c.code !== 'BK' && (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Usuń"
                onClick={async () => {
                  if (await confirm({ title: `Usunąć kategorię ${c.name}?`, description: `${usage(c)} pozycji dostanie kategorię „Bez kategorii” (SKU zmieni się na prefiks BK).` })) remove.mutate(c.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function LocationsSection() {
  const lookups = useLookups();
  const items = useItems();
  const consumables = useConsumables();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<{ id?: number; name: string; room: string; responsible_id: string | null } | null>(null);
  const insert = useInsert('locations', { invalidate: [qk.locations], success: 'Dodano miejsce' });
  const update = useUpdate('locations', { invalidate: [qk.locations], success: 'Zapisano' });
  const remove = useDelete('locations', { invalidate: [qk.locations, qk.items, qk.consumables], success: 'Usunięto miejsce' });

  const usage = (l: Location) => (items.data ?? []).filter((i) => i.location_id === l.id).length + (consumables.data ?? []).filter((x) => x.location_id === l.id).length;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const values = { name: draft.name.trim(), room: draft.room.trim() || null, responsible_id: draft.responsible_id };
    if (draft.id) await update.mutateAsync({ id: draft.id, values });
    else await insert.mutateAsync({ ...values, kind: 'permanent' });
    setDraft(null);
  };

  return (
    <Section
      icon={MapPin}
      title="Miejsca w magazynie"
      description="Szafy, regały, półki. Skrzynie wyjazdowe tworzy się w wyjeździe."
      action={
        <Button size="sm" variant="ghost" onClick={() => setDraft({ name: '', room: '', responsible_id: null })}>
          <Plus className="h-4 w-4" /> Dodaj
        </Button>
      }
    >
      {draft && (
        <form onSubmit={save} className="mb-3 grid gap-2 rounded-xl border border-zinc-800 p-3 sm:grid-cols-2">
          <Input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nazwa, np. Szafa A / półka 2" maxLength={80} required />
          <Input value={draft.room} onChange={(e) => setDraft({ ...draft, room: e.target.value })} placeholder="Sala, np. B4 / 112" />
          <PersonSelect lookups={lookups} value={draft.responsible_id} onChange={(v) => setDraft({ ...draft, responsible_id: v })} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Anuluj
            </Button>
            <Button type="submit" variant="primary" loading={insert.isPending || update.isPending}>
              Zapisz
            </Button>
          </div>
        </form>
      )}
      {lookups.permanentLocations.length === 0 && !draft ? (
        <p className="text-sm text-zinc-500">Dodaj pierwsze miejsce, żeby wiedzieć, gdzie co leży.</p>
      ) : (
        <ul className="divide-y divide-zinc-800/70">
          {lookups.permanentLocations.map((l) => (
            <li key={l.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm text-zinc-200">{l.name}</span>
                <span className="text-xs text-zinc-500">
                  {[l.room, lookups.person(l.responsible_id)?.display_name, `${usage(l)} poz.`].filter(Boolean).join(' · ')}
                </span>
              </div>
              <Button size="icon-sm" variant="ghost" onClick={() => setDraft({ id: l.id, name: l.name, room: l.room ?? '', responsible_id: l.responsible_id })} aria-label="Edytuj">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Usuń"
                onClick={async () => {
                  if (await confirm({ title: `Usunąć ${l.name}?`, description: usage(l) ? `${usage(l)} pozycji straci przypisane miejsce.` : 'Miejsce jest puste.' })) remove.mutate(l.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
