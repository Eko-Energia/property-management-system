'use client';

import { Combobox, type ComboOption } from '@/components/ui/combobox';
import type { Lookups } from '@/lib/data/lookups';

type Common = { id?: string; lookups: Lookups; disabled?: boolean; className?: string };

export function CategorySelect({ id, lookups, value, onChange, disabled, className, emptyLabel }: Common & { value: number | null; onChange: (v: number | null) => void; emptyLabel?: string }) {
  const options: ComboOption<number>[] = lookups.categories.map((c) => ({ value: c.id, label: c.name, hint: c.code }));
  return <Combobox id={id} className={className} value={value} onChange={onChange} options={options} disabled={disabled} placeholder="Wybierz kategorię" emptyLabel={emptyLabel} />;
}

/** Permanent places only, or (withBoxes) also boxes of non-closed events, grouped. */
export function LocationSelect({
  id,
  lookups,
  value,
  onChange,
  disabled,
  className,
  withBoxes = false,
  emptyLabel = '— brak —',
}: Common & { value: number | null; onChange: (v: number | null) => void; withBoxes?: boolean; emptyLabel?: string }) {
  const options: ComboOption<number>[] = lookups.permanentLocations.map((l) => ({
    value: l.id,
    label: l.name,
    hint: [l.room, lookups.person(l.responsible_id)?.display_name].filter(Boolean).join(' · ') || null,
    group: withBoxes ? 'Magazyn / warsztat' : undefined,
  }));
  if (withBoxes) {
    for (const e of lookups.events.filter((ev) => ev.status !== 'closed')) {
      for (const b of lookups.locations.filter((l) => l.kind === 'event_box' && l.event_id === e.id)) {
        options.push({ value: b.id, label: b.name, hint: e.name, group: `Wyjazd: ${e.name}` });
      }
    }
  }
  return <Combobox id={id} className={className} value={value} onChange={onChange} options={options} disabled={disabled} placeholder="Wybierz miejsce" emptyLabel={emptyLabel} />;
}

export function PersonSelect({ id, lookups, value, onChange, disabled, className, emptyLabel = '— nikt —' }: Common & { value: string | null; onChange: (v: string | null) => void; emptyLabel?: string }) {
  const options: ComboOption<string>[] = lookups.profiles.filter((p) => p.role !== 'guest').map((p) => ({ value: p.id, label: p.display_name }));
  return <Combobox id={id} className={className} value={value} onChange={onChange} options={options} disabled={disabled} placeholder="Wybierz osobę" emptyLabel={emptyLabel} />;
}
