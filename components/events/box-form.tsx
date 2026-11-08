'use client';

import { useState } from 'react';
import { useLookups } from '@/lib/data/lookups';
import { useInsert, useUpdate } from '@/lib/data/mutations';
import { qk } from '@/lib/data/keys';
import type { Location } from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { LocationSelect, PersonSelect } from '@/components/inventory/pickers';

type Draft = { name: string; responsible_id: string | null; stored_at_id: number | null };

/** Create or edit an event box: name, who looks after it, where it physically stands. */
export function BoxForm({
  open,
  onClose,
  eventId,
  box,
  defaultName,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  eventId: number;
  box: Location | null;
  defaultName: string;
  onSaved?: (box: Location) => void;
}) {
  const lookups = useLookups();
  const insert = useInsert('locations', { invalidate: [qk.locations], success: 'Dodano skrzynię' });
  const update = useUpdate('locations', { invalidate: [qk.locations], success: 'Zapisano skrzynię' });

  // reset the draft whenever the form is (re)opened for a different box
  const seed = open ? `${box?.id ?? 'new'}` : null;
  const [seenSeed, setSeenSeed] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: '', responsible_id: null, stored_at_id: null });
  if (seed !== seenSeed) {
    setSeenSeed(seed);
    if (seed) setDraft({ name: box?.name ?? defaultName, responsible_id: box?.responsible_id ?? null, stored_at_id: box?.stored_at_id ?? null });
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const values = { name: draft.name.trim(), responsible_id: draft.responsible_id, stored_at_id: draft.stored_at_id };
    if (!values.name) return;
    const saved = box ? await update.mutateAsync({ id: box.id, values }) : await insert.mutateAsync({ ...values, kind: 'event_box', event_id: eventId });
    onSaved?.(saved);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={box ? `Skrzynia: ${box.name}` : 'Nowa skrzynia'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Anuluj
          </Button>
          <Button type="submit" form="box-form" variant="primary" loading={insert.isPending || update.isPending}>
            {box ? 'Zapisz' : 'Dodaj skrzynię'}
          </Button>
        </>
      }
    >
      <form id="box-form" onSubmit={submit} className="space-y-4">
        <Field label="Nazwa" required hint="Najlepiej to, co jest napisane na pudle.">
          {(id) => <Input id={id} autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={80} required />}
        </Field>
        <Field label="Opiekun skrzyni" hint="Kto ją pakuje i pilnuje na wyjeździe.">
          {(id) => <PersonSelect id={id} lookups={lookups} value={draft.responsible_id} onChange={(v) => setDraft({ ...draft, responsible_id: v })} />}
        </Field>
        <Field label="Gdzie stoi" hint="Stałe miejsce z magazynu, np. regał przy wejściu albo bus. Nowe miejsca dodasz w Magazyn → Miejsca.">
          {(id) => <LocationSelect id={id} lookups={lookups} value={draft.stored_at_id} onChange={(v) => setDraft({ ...draft, stored_at_id: v })} emptyLabel="— nie wiadomo —" />}
        </Field>
      </form>
    </Modal>
  );
}
