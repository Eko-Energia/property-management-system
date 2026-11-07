'use client';

import { History } from 'lucide-react';
import { useActivity } from '@/lib/data/queries';
import { useLookups, type Lookups } from '@/lib/data/lookups';
import { formatRelative, ITEM_STATUS, SHOPPING_STATUS } from '@/lib/format';
import type { ActivityEntry, ItemStatus, ShoppingStatus } from '@/lib/types';
import { ListSkeleton } from '@/components/ui/misc';

type Row = Record<string, unknown>;

const TABLE_NOUN: Record<string, string> = {
  items: 'sprzęt',
  consumables: 'materiał',
  locations: 'miejsce',
  events: 'wyjazd',
  event_consumables: 'pozycję wyjazdu',
  shopping_list: 'zgłoszenie zakupu',
  categories: 'kategorię',
};

const FIELD_LABEL: Record<string, string> = {
  name: 'nazwa',
  quantity_stored: 'stan',
  min_quantity: 'minimum',
  location_id: 'miejsce',
  status: 'status',
  barcode: 'etykieta',
  sku: 'SKU',
  responsible_id: 'opiekun',
  shop_link: 'link',
  notes: 'notatki',
  unit: 'jednostka',
  quantity: 'ilość',
  price_estimate: 'cena',
  quantity_packed: 'spakowano',
  quantity_required: 'potrzeba',
};

const IGNORED = new Set(['updated_at', 'category_id', 'home_location_id', 'ordered_at', 'received_at', 'closed_at']);

function changed(oldRow: Row, newRow: Row) {
  return Object.keys(newRow).filter((k) => !IGNORED.has(k) && JSON.stringify(oldRow[k]) !== JSON.stringify(newRow[k]));
}

/** Human, gender-neutral description of one audit row. */
export function describeActivity(entry: ActivityEntry, lookups: Lookups): { title: string; subject: string | null } {
  const oldRow = (entry.old_data ?? {}) as Row;
  const newRow = (entry.new_data ?? {}) as Row;
  const subject = (newRow.name ?? oldRow.name ?? null) as string | null;
  const num = (v: unknown) => Number(v ?? 0);

  switch (entry.context) {
    case 'item_pack':
      return { title: `Spakowano do: ${lookups.locationLabel(newRow.location_id as number) ?? 'skrzynia'}`, subject };
    case 'item_assign':
      return { title: `Przypisano do wyjazdu: ${lookups.locationLabel(newRow.location_id as number) ?? ''}`, subject };
    case 'item_unpack':
      return { title: 'Wyjęto ze skrzyni', subject };
    case 'item_return':
      return { title: `Zwrócono do: ${lookups.locationLabel(newRow.location_id as number) ?? 'magazynu'}`, subject };
    case 'item_mark_missing':
      return { title: 'Oznaczono jako zaginiony', subject };
    case 'item_mark_broken':
      return { title: 'Oznaczono jako uszkodzony', subject };
    case 'label_assign':
      return { title: newRow.barcode ? `Przypisano etykietę ${newRow.barcode}` : `Zdjęto etykietę ${oldRow.barcode ?? ''}`, subject };
    case 'purchase_receive':
      if (entry.table_name === 'shopping_list') return { title: 'Przyjęto zakup na magazyn', subject };
      break;
    case 'box_delete':
      if (entry.table_name === 'locations') return { title: 'Usunięto skrzynię (zawartość wróciła na magazyn)', subject };
      break;
    case 'event_close':
      if (entry.table_name === 'events') return { title: 'Zamknięto i rozliczono wyjazd', subject };
      break;
  }

  if (entry.action === 'INSERT') return { title: `Dodano ${TABLE_NOUN[entry.table_name] ?? 'rekord'}`, subject };
  if (entry.action === 'DELETE') return { title: `Usunięto ${TABLE_NOUN[entry.table_name] ?? 'rekord'}`, subject };

  if (entry.table_name === 'consumables' && changed(oldRow, newRow).includes('quantity_stored')) {
    const delta = num(newRow.quantity_stored) - num(oldRow.quantity_stored);
    const why =
      entry.context === 'consumable_pack' ? ' (spakowano na wyjazd)'
      : entry.context === 'consumable_unpack' ? ' (rozpakowano)'
      : entry.context === 'consumable_return' ? ' (zwrot z wyjazdu)'
      : entry.context === 'purchase_receive' ? ' (dostawa)'
      : entry.context === 'box_delete' ? ' (usunięta skrzynia)'
      : '';
    return { title: `Stan ${num(oldRow.quantity_stored)} → ${num(newRow.quantity_stored)} (${delta > 0 ? '+' : ''}${delta})${why}`, subject };
  }
  if (entry.table_name === 'items' && oldRow.status !== newRow.status) {
    return { title: `Status: ${ITEM_STATUS[newRow.status as ItemStatus]?.label ?? newRow.status}`, subject };
  }
  if (entry.table_name === 'shopping_list' && oldRow.status !== newRow.status) {
    return { title: `Zakup: ${SHOPPING_STATUS[newRow.status as ShoppingStatus]?.label ?? newRow.status}`, subject };
  }
  const fields = changed(oldRow, newRow).map((k) => FIELD_LABEL[k] ?? k);
  return { title: fields.length ? `Zmieniono: ${fields.join(', ')}` : 'Zmieniono', subject };
}

export function ActivityList({ table, rowId, limit = 20, showSubject = false }: { table?: string; rowId?: number; limit?: number; showSubject?: boolean }) {
  const lookups = useLookups();
  const activity = useActivity(table && rowId != null ? { table, rowId } : undefined, limit);

  if (activity.isPending) return <ListSkeleton rows={3} />;
  const rows = activity.data ?? [];
  if (rows.length === 0) {
    return (
      <p className="flex items-center gap-2 py-4 text-sm text-zinc-500">
        <History className="h-4 w-4" /> Brak historii zmian.
      </p>
    );
  }

  return (
    <ol className="relative space-y-3 border-l border-zinc-800 pl-4">
      {rows.map((entry) => {
        const { title, subject } = describeActivity(entry, lookups);
        return (
          <li key={entry.id} className="relative">
            <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-950 bg-zinc-600" />
            <p className="text-sm text-zinc-200">
              {showSubject && subject && <span className="font-medium text-zinc-50">{subject}: </span>}
              {title}
            </p>
            <p className="text-xs text-zinc-500">
              {lookups.person(entry.actor_id)?.display_name ?? (entry.actor_id ? 'Użytkownik' : 'System')} · {formatRelative(entry.at)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
