'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getSupabase } from '@/lib/supabase/client';
import { rpc } from '@/lib/data/mutations';
import { qk } from '@/lib/data/keys';
import { errorMessage } from '@/lib/errors';
import { useLookups } from '@/lib/data/lookups';
import type { Consumable, Item } from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Mono } from '@/components/ui/misc';
import { CategorySelect, LocationSelect, PersonSelect } from './pickers';
import { LabelField, type LabelConflict } from './label-field';

type Kind = 'item' | 'consumable';

type FormState = {
  name: string;
  category_id: number | null;
  location_id: number | null;
  responsible_id: string | null;
  shop_link: string;
  notes: string;
  barcode: string;
  // consumables only
  quantity_stored: number;
  min_quantity: number;
  unit: string;
};

function initialState(kind: Kind, record: Item | Consumable | null, defaults: Partial<FormState>): FormState {
  const c = kind === 'consumable' ? (record as Consumable | null) : null;
  return {
    name: record?.name ?? '',
    category_id: record?.category_id ?? defaults.category_id ?? null,
    location_id: record?.location_id ?? defaults.location_id ?? null,
    responsible_id: record?.responsible_id ?? defaults.responsible_id ?? null,
    shop_link: record?.shop_link ?? '',
    notes: record?.notes ?? '',
    barcode: record?.barcode ?? defaults.barcode ?? '',
    quantity_stored: c?.quantity_stored ?? 0,
    min_quantity: c?.min_quantity ?? 0,
    unit: c?.unit ?? 'szt.',
  };
}

/**
 * Create/edit form for items and consumables. SKU is assigned by the DB
 * (shown as a preview), labels are checked for conflicts and moved atomically.
 */
export function InventoryForm({
  kind,
  open,
  onClose,
  record,
  defaults = {},
  onSaved,
}: {
  kind: Kind;
  open: boolean;
  onClose: () => void;
  record: Item | Consumable | null;
  defaults?: Partial<FormState>;
  onSaved?: (row: Item | Consumable) => void;
}) {
  const lookups = useLookups();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(() => initialState(kind, record, defaults));
  const [conflict, setConflict] = useState<LabelConflict>(null);
  const [saving, setSaving] = useState(false);

  // reset when the dialog opens or switches record, never on background refetches
  const seedKey = open ? `${kind}:${record?.id ?? 'new'}` : null;
  const [seed, setSeed] = useState<string | null>(null);
  if (seedKey !== seed) {
    setSeed(seedKey);
    if (seedKey) {
      setForm(initialState(kind, record, defaults));
      setConflict(null);
    }
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const categoryId = form.category_id ?? lookups.defaultCategoryId;
  const categoryChanged = record ? categoryId !== record.category_id : true;
  const lockedLocation = kind === 'item' && record !== null && ['assigned_to_event', 'packed'].includes((record as Item).status);

  const skuPreview = useQuery({
    queryKey: ['sku-preview', kind, categoryId],
    enabled: open && categoryChanged && categoryId != null,
    staleTime: 5_000,
    queryFn: () => rpc('next_sku', { p_kind: kind === 'item' ? 'I' : 'C', p_category_id: categoryId }),
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const supabase = getSupabase();
      const barcode = form.barcode.trim() || null;
      const moveLabel = Boolean(barcode && conflict);
      const common = {
        name: form.name.trim(),
        category_id: categoryId,
        location_id: form.location_id,
        responsible_id: form.responsible_id,
        shop_link: form.shop_link.trim() || null,
        notes: form.notes.trim() || null,
        // a label still attached elsewhere is moved after the save via assign_label
        ...(moveLabel ? {} : { barcode }),
      };

      let row: Item | Consumable;
      if (kind === 'item') {
        const values = { ...common, ...(record ? {} : { home_location_id: form.location_id }) };
        const res = record
          ? await supabase.from('items').update(values).eq('id', record.id).select().single()
          : await supabase.from('items').insert(values).select().single();
        if (res.error) throw res.error;
        row = res.data;
      } else {
        const values = { ...common, min_quantity: form.min_quantity, unit: form.unit.trim() || 'szt.', ...(record ? {} : { quantity_stored: form.quantity_stored }) };
        const res = record
          ? await supabase.from('consumables').update(values).eq('id', record.id).select().single()
          : await supabase.from('consumables').insert(values).select().single();
        if (res.error) throw res.error;
        row = res.data;
      }

      if (moveLabel && barcode) {
        await rpc('assign_label', { p_code: barcode, p_kind: kind, p_id: row.id });
        row = { ...row, barcode };
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: kind === 'item' ? qk.items : qk.consumables }),
        moveLabel && qc.invalidateQueries({ queryKey: kind === 'item' ? qk.consumables : qk.items }),
      ]);
      toast.success(record ? 'Zapisano zmiany' : `Dodano ${row.sku}`);
      onSaved?.(row);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const title = record ? `Edytuj: ${record.name}` : kind === 'item' ? 'Nowy sprzęt' : 'Nowy materiał';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={record ? <Mono>{record.sku}</Mono> : kind === 'item' ? 'Sprzęt trwały: każdy egzemplarz to osobny rekord.' : 'Materiał liczony w sztukach (śruby, cyna, taśma…).'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Anuluj
          </Button>
          <Button variant="primary" type="submit" form="inventory-form" loading={saving} disabled={!form.name.trim()}>
            {record ? 'Zapisz' : 'Dodaj'}
          </Button>
        </>
      }
    >
      <form id="inventory-form" onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nazwa" required className="sm:col-span-2">
          {(id) => <Input id={id} value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={120} autoFocus placeholder={kind === 'item' ? 'np. Lutownica Hakko FX-888D' : 'np. Śruba M3x10 nierdzewna'} />}
        </Field>

        <Field
          label="Kategoria"
          hint={
            categoryChanged && skuPreview.data ? (
              <>
                SKU: <Mono className="text-zinc-300">{skuPreview.data}</Mono>
                {record && ' (zmieni się po zapisie)'}
              </>
            ) : undefined
          }
        >
          {(id) => <CategorySelect id={id} lookups={lookups} value={categoryId} onChange={(v) => set('category_id', v)} />}
        </Field>

        <Field
          label="Miejsce w magazynie"
          hint={lockedLocation ? 'Przedmiot jest na wyjeździe: zmień to akcją „Zwróć” w szczegółach.' : undefined}
        >
          {(id) => (
            <LocationSelect
              id={id}
              lookups={lookups}
              value={form.location_id}
              onChange={(v) => set('location_id', v)}
              withBoxes={lockedLocation}
              disabled={lockedLocation}
            />
          )}
        </Field>

        {kind === 'consumable' && (
          <>
            {!record && (
              <Field label="Stan początkowy">
                {(id) => <Input id={id} type="number" inputMode="numeric" min={0} value={form.quantity_stored} onChange={(e) => set('quantity_stored', Math.max(0, Number(e.target.value) || 0))} />}
              </Field>
            )}
            <Field label="Minimum (alert + auto-zamówienie)" hint="0 = bez alertu">
              {(id) => <Input id={id} type="number" inputMode="numeric" min={0} value={form.min_quantity} onChange={(e) => set('min_quantity', Math.max(0, Number(e.target.value) || 0))} />}
            </Field>
            <Field label="Jednostka">
              {(id) => <Input id={id} value={form.unit} onChange={(e) => set('unit', e.target.value)} maxLength={12} placeholder="szt., m, kg, op." />}
            </Field>
          </>
        )}

        <Field label="Opiekun">
          {(id) => <PersonSelect id={id} lookups={lookups} value={form.responsible_id} onChange={(v) => set('responsible_id', v)} />}
        </Field>

        <Field label="Etykieta (kod kreskowy)" className="sm:col-span-2">
          {(id) => (
            <LabelField id={id} value={form.barcode} onChange={(v) => set('barcode', v)} self={record ? { kind, id: record.id } : undefined} onConflictChange={setConflict} />
          )}
        </Field>

        <Field label="Link do sklepu" className="sm:col-span-2">
          {(id) => <Input id={id} type="url" value={form.shop_link} onChange={(e) => set('shop_link', e.target.value)} placeholder="https://…" />}
        </Field>

        <Field label="Notatki" className="sm:col-span-2">
          {(id) => <Textarea id={id} value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} placeholder="Numer seryjny, stan, uwagi…" />}
        </Field>
      </form>
    </Modal>
  );
}
