'use client';

import { useState } from 'react';
import { AlertOctagon, CheckCheck, Undo2, Wrench } from 'lucide-react';
import { useConsumables, useEventConsumables, useItems } from '@/lib/data/queries';
import { INVENTORY_KEYS, rpc, useAction } from '@/lib/data/mutations';
import { qk } from '@/lib/data/keys';
import type { InventoryEvent, Item, Location } from '@/lib/types';
import { ITEM_STATUS } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Badge, Card, Mono } from '@/components/ui/misc';
import { useConfirm } from '@/components/ui/confirm';

/**
 * After the event: confirm what came back. Items: returned / missing / broken.
 * Consumables: returned quantity goes back to stock, the rest is booked as used.
 */
export function Settlement({ event, boxes }: { event: InventoryEvent; boxes: Location[] }) {
  const confirm = useConfirm();
  const items = useItems();
  const consumables = useConsumables();
  const ecs = useEventConsumables();
  const [returned, setReturned] = useState<Record<number, string>>({});
  const boxIds = new Set(boxes.map((b) => b.id));
  const closed = event.status === 'closed';

  const openItems = (items.data ?? []).filter((i) => i.location_id != null && boxIds.has(i.location_id) && ['assigned_to_event', 'packed'].includes(i.status));
  const lines = (ecs.data ?? []).filter((ec) => boxIds.has(ec.box_id) && ec.quantity_packed > 0);
  const openLines = lines.filter((l) => l.quantity_returned == null);
  const consumableById = new Map((consumables.data ?? []).map((c) => [c.id, c]));

  const itemAction = useAction({
    fn: ({ item, action }: { item: Item; action: 'return' | 'missing' | 'broken' }) =>
      action === 'return' ? rpc('return_item', { p_item_id: item.id }) : rpc('mark_item', { p_item_id: item.id, p_status: action }),
    invalidate: [qk.items],
  });
  const settleLine = useAction({
    fn: ({ id, qty }: { id: number; qty: number }) => rpc('return_event_consumable', { p_ec_id: id, p_returned: qty }),
    invalidate: [qk.eventConsumables, qk.consumables],
  });
  const close = useAction({
    fn: (autoReturn: boolean) => rpc('close_event', { p_event_id: event.id, p_auto_return: autoReturn }),
    invalidate: [...INVENTORY_KEYS, qk.events],
    success: 'Wyjazd zamknięty i rozliczony',
  });

  const closeAll = async () => {
    const ok = await confirm({
      title: 'Zwrócić wszystko i zamknąć?',
      description: 'Cały sprzęt wróci do swoich miejsc, a materiały w pełnych ilościach na stan. Użyj, gdy nic nie zginęło i nic nie zostało zużyte.',
      confirmLabel: 'Zwróć i zamknij',
      tone: 'primary',
    });
    if (ok) close.mutate(true);
  };

  if (closed) {
    const used = lines.reduce((s, l) => s + (l.quantity_packed - (l.quantity_returned ?? 0)), 0);
    return (
      <Card className="p-4 text-sm text-zinc-300">
        <p className="font-medium text-zinc-100">Wyjazd rozliczony.</p>
        <p className="mt-1 text-zinc-400">Zużyto łącznie {used} szt. materiałów.</p>
        <ul className="mt-3 space-y-1">
          {lines.map((l) => {
            const c = consumableById.get(l.consumable_id);
            return (
              <li key={l.id} className="flex justify-between text-xs">
                <span>{c?.name}</span>
                <span className="text-zinc-500">
                  zabrano {l.quantity_packed}, wróciło {l.quantity_returned ?? 0}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Sprzęt do potwierdzenia ({openItems.length})</h3>
        {openItems.length === 0 ? (
          <p className="text-sm text-emerald-400">Cały sprzęt rozliczony.</p>
        ) : (
          <ul className="space-y-2">
            {openItems.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-100">{item.name}</span>
                  <span className="text-xs text-zinc-500">
                    <Mono>{item.sku}</Mono> · {boxes.find((b) => b.id === item.location_id)?.name}{' '}
                    {item.status !== 'packed' && <Badge tone={ITEM_STATUS[item.status].tone}>{ITEM_STATUS[item.status].label}</Badge>}
                  </span>
                </div>
                <Button size="sm" variant="success" onClick={() => itemAction.mutate({ item, action: 'return' })}>
                  <Undo2 className="h-4 w-4" /> Wrócił
                </Button>
                <Button size="sm" variant="ghost" onClick={() => itemAction.mutate({ item, action: 'missing' })}>
                  <AlertOctagon className="h-4 w-4" /> Zaginął
                </Button>
                <Button size="sm" variant="ghost" onClick={() => itemAction.mutate({ item, action: 'broken' })}>
                  <Wrench className="h-4 w-4" /> Uszkodzony
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Materiały: ile wróciło ({openLines.length})</h3>
        {openLines.length === 0 ? (
          <p className="text-sm text-emerald-400">Materiały rozliczone.</p>
        ) : (
          <ul className="space-y-2">
            {openLines.map((line) => {
              const c = consumableById.get(line.consumable_id);
              const value = returned[line.id] ?? String(line.quantity_packed);
              return (
                <li key={line.id} className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-100">{c?.name}</span>
                    <span className="text-xs text-zinc-500">zabrano {line.quantity_packed}</span>
                  </div>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={line.quantity_packed}
                    value={value}
                    onChange={(e) => setReturned((r) => ({ ...r, [line.id]: e.target.value }))}
                    className="h-9 w-20 text-center"
                    aria-label="Wróciło sztuk"
                  />
                  <Button
                    size="sm"
                    onClick={() => settleLine.mutate({ id: line.id, qty: Math.min(line.quantity_packed, Math.max(0, Math.floor(Number(value) || 0))) })}
                  >
                    Rozlicz
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={closeAll} loading={close.isPending && close.variables === true}>
          <CheckCheck className="h-4 w-4" /> Zwróć wszystko i zamknij
        </Button>
        <Button
          variant="primary"
          disabled={openItems.length > 0 || openLines.length > 0}
          loading={close.isPending && close.variables === false}
          onClick={() => close.mutate(false)}
        >
          Zamknij wyjazd
        </Button>
      </div>
    </div>
  );
}
