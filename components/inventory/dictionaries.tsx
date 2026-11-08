'use client';

import { useState } from 'react';
import { Check, ChevronRight, MapPin, Pencil, Plus, Tags, Trash2, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useConsumables, useItems } from '@/lib/data/queries';
import { useLookups } from '@/lib/data/lookups';
import { useDelete, useInsert, useUpdate } from '@/lib/data/mutations';
import { qk } from '@/lib/data/keys';
import type { Category, Location } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Card, EmptyState, Mono } from '@/components/ui/misc';
import { useConfirm } from '@/components/ui/confirm';
import { PersonSelect } from './pickers';

/** Shelves, cupboards, rooms. Clicking a place shows what is stored there. */
export function LocationsManager({ onShow }: { onShow: (locationId: number) => void }) {
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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">Szafy, regały, półki. Skrzynie wyjazdowe tworzy się w wyjeździe.</p>
        <Button size="sm" variant="primary" onClick={() => setDraft({ name: '', room: '', responsible_id: null })}>
          <Plus className="h-4 w-4" /> Miejsce
        </Button>
      </div>

      {draft && (
        <Card className="p-4">
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-3">
            <Field label="Nazwa" required>
              {(id) => <Input id={id} autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="np. Szafa A / półka 2" maxLength={80} required />}
            </Field>
            <Field label="Sala">
              {(id) => <Input id={id} value={draft.room} onChange={(e) => setDraft({ ...draft, room: e.target.value })} placeholder="np. B4 / 112" />}
            </Field>
            <Field label="Opiekun">
              {(id) => <PersonSelect id={id} lookups={lookups} value={draft.responsible_id} onChange={(v) => setDraft({ ...draft, responsible_id: v })} />}
            </Field>
            <div className="flex justify-end gap-2 sm:col-span-3">
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Anuluj
              </Button>
              <Button type="submit" variant="primary" loading={insert.isPending || update.isPending}>
                {draft.id ? 'Zapisz' : 'Dodaj'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {lookups.permanentLocations.length === 0 && !draft ? (
        <EmptyState icon={MapPin} title="Brak miejsc">
          Dodaj pierwsze miejsce, żeby wiedzieć, gdzie co leży.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-zinc-800/70 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/30">
          {lookups.permanentLocations.map((l) => (
            <li key={l.id} className="flex items-center gap-1 pr-2">
              <button onClick={() => onShow(l.id)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/40">
                <MapPin className="h-4 w-4 shrink-0 text-zinc-500" />
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-zinc-100">{l.name}</span>
                  <span className="text-xs text-zinc-500">{[l.room, lookups.person(l.responsible_id)?.display_name, `${usage(l)} poz.`].filter(Boolean).join(' · ')}</span>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
              </button>
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
    </div>
  );
}

export function CategoriesManager({ onShow }: { onShow: (categoryId: number) => void }) {
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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">Kod kategorii tworzy prefiks SKU (np. EL → I-EL-0001).</p>
        <Button size="sm" variant="primary" onClick={() => setDraft({ name: '', code: '' })}>
          <Plus className="h-4 w-4" /> Kategoria
        </Button>
      </div>

      {draft && (
        <Card className="p-4">
          <form onSubmit={save} className="flex items-end gap-2">
            <Field label="Nazwa" required className="flex-1">
              {(id) => <Input id={id} autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="np. Elektronika" maxLength={60} required />}
            </Field>
            <Field label="Kod" required>
              {(id) => (
                <Input
                  id={id}
                  value={draft.code}
                  onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) })}
                  placeholder="EL"
                  className="w-20 text-center font-mono"
                  required
                  minLength={2}
                  disabled={draft.code === 'BK' && Boolean(draft.id)}
                />
              )}
            </Field>
            <Button type="submit" size="icon" variant="primary" aria-label="Zapisz" loading={insert.isPending || update.isPending}>
              <Check className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setDraft(null)} aria-label="Anuluj">
              <X className="h-4 w-4" />
            </Button>
          </form>
        </Card>
      )}

      <ul className="divide-y divide-zinc-800/70 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/30">
        {lookups.categories.map((c) => (
          <li key={c.id} className="flex items-center gap-1 pr-2">
            <button onClick={() => onShow(c.id)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/40">
              <Tags className="h-4 w-4 shrink-0 text-zinc-500" />
              <Mono className="w-10 text-zinc-300">{c.code}</Mono>
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-100">{c.name}</span>
              <span className="text-xs text-zinc-500">{usage(c)} poz.</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
            </button>
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
    </div>
  );
}
