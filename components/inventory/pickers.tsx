'use client';

import { Select } from '@/components/ui/field';
import type { Lookups } from '@/lib/data/lookups';

type Common = { id?: string; lookups: Lookups; disabled?: boolean };

export function CategorySelect({ id, lookups, value, onChange, disabled }: Common & { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <Select id={id} value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      {lookups.categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name} ({c.code})
        </option>
      ))}
    </Select>
  );
}

/** Permanent places only, or (withBoxes) also boxes of non-closed events, grouped. */
export function LocationSelect({
  id,
  lookups,
  value,
  onChange,
  disabled,
  withBoxes = false,
  emptyLabel = '— brak —',
}: Common & { value: number | null; onChange: (v: number | null) => void; withBoxes?: boolean; emptyLabel?: string }) {
  const boxesByEvent = withBoxes
    ? lookups.events
        .filter((e) => e.status !== 'closed')
        .map((e) => ({ event: e, boxes: lookups.locations.filter((l) => l.kind === 'event_box' && l.event_id === e.id) }))
        .filter((g) => g.boxes.length > 0)
    : [];
  return (
    <Select id={id} value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
      <option value="">{emptyLabel}</option>
      <optgroup label="Magazyn / warsztat">
        {lookups.permanentLocations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.room ? `${l.name} (${l.room})` : l.name}
          </option>
        ))}
      </optgroup>
      {boxesByEvent.map(({ event, boxes }) => (
        <optgroup key={event.id} label={`Wyjazd: ${event.name}`}>
          {boxes.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}

export function PersonSelect({ id, lookups, value, onChange, disabled }: Common & { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <Select id={id} value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">— nikt —</option>
      {lookups.profiles
        .filter((p) => p.role !== 'guest')
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.display_name}
          </option>
        ))}
    </Select>
  );
}
