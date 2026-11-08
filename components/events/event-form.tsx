'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useInsert, useUpdate } from '@/lib/data/mutations';
import { qk } from '@/lib/data/keys';
import type { InventoryEvent } from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';

const today = () => new Date().toISOString().slice(0, 10);

export function EventForm({ open, onClose, record }: { open: boolean; onClose: () => void; record: InventoryEvent | null }) {
  const router = useRouter();
  const insert = useInsert('events', { invalidate: [qk.events, qk.stats], success: 'Utworzono wyjazd' });
  const update = useUpdate('events', { invalidate: [qk.events], success: 'Zapisano' });
  const [form, setForm] = useState({ name: '', start_date: today(), end_date: '', place: '', notes: '' });
  const [seed, setSeed] = useState<number | 'new' | null>(null);

  const key = record?.id ?? 'new';
  if (open && seed !== key) {
    setSeed(key);
    setForm({
      name: record?.name ?? '',
      start_date: record?.start_date ?? today(),
      end_date: record?.end_date ?? '',
      place: record?.place ?? '',
      notes: record?.notes ?? '',
    });
  }
  if (!open && seed !== null) setSeed(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const values = {
      name: form.name.trim(),
      start_date: form.start_date,
      end_date: form.end_date || null,
      place: form.place.trim() || null,
      notes: form.notes.trim() || null,
    };
    if (record) {
      await update.mutateAsync({ id: record.id, values });
      onClose();
    } else {
      const created = await insert.mutateAsync(values);
      onClose();
      router.push(`/zawody/${created.id}`);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={record ? 'Edytuj wyjazd' : 'Nowy wyjazd'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Anuluj
          </Button>
          <Button variant="primary" type="submit" form="event-form" loading={insert.isPending || update.isPending} disabled={!form.name.trim()}>
            {record ? 'Zapisz' : 'Utwórz'}
          </Button>
        </>
      }
    >
      <form id="event-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nazwa" required className="sm:col-span-2">
          {(id) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={120} placeholder="np. Shell Eco-marathon 2027" />}
        </Field>
        <Field label="Start" required>
          {(id) => <Input id={id} type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />}
        </Field>
        <Field label="Koniec">
          {(id) => <Input id={id} type="date" value={form.end_date} min={form.start_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />}
        </Field>
        <Field label="Miejsce" className="sm:col-span-2">
          {(id) => <Input id={id} value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} placeholder="np. Nogaro, Francja" />}
        </Field>
        <Field label="Notatki" className="sm:col-span-2">
          {(id) => <Textarea id={id} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />}
        </Field>
      </form>
    </Modal>
  );
}
