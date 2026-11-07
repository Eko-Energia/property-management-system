'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, PackagePlus, Pencil, Plus, Trash2, Undo2, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useConsumables, useEventConsumables, useItems } from '@/lib/data/queries';
import { useLookups } from '@/lib/data/lookups';
import { INVENTORY_KEYS, rpc, useAction, usePackConsumable, useUpdate } from '@/lib/data/mutations';
import { qk } from '@/lib/data/keys';
import { errorMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase/client';
import type { Item, Location } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Badge, Card, Mono, Stepper } from '@/components/ui/misc';
import { useConfirm } from '@/components/ui/confirm';
import { cn } from '@/components/ui/cn';
import { Picker } from '@/components/inventory/picker';

export function BoxPanel({ box, readOnly, onOpenItem }: { box: Location; readOnly: boolean; onOpenItem: (item: Item) => void }) {
  const lookups = useLookups();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const items = useItems();
  const consumables = useConsumables();
  const ecs = useEventConsumables();
  const pack = usePackConsumable();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [addingItems, setAddingItems] = useState(false);
  const [addingConsumable, setAddingConsumable] = useState(false);
  const [requiredQty, setRequiredQty] = useState(1);

  const boxItems = (items.data ?? []).filter((i) => i.location_id === box.id && (i.status === 'assigned_to_event' || i.status === 'packed'));
  const lines = (ecs.data ?? []).filter((ec) => ec.box_id === box.id);
  const consumableById = new Map((consumables.data ?? []).map((c) => [c.id, c]));
  const available = (items.data ?? []).filter((i) => i.status === 'in_workshop');

  const togglePack = useAction({
    fn: (item: Item) => (item.status === 'packed' ? rpc('unpack_item', { p_item_id: item.id }) : rpc('move_item_to_box', { p_item_id: item.id, p_box_id: box.id, p_status: 'packed' })),
    invalidate: [qk.items],
  });
  const removeItem = useAction({ fn: (item: Item) => rpc('return_item', { p_item_id: item.id }), invalidate: [qk.items], success: 'Zwrócono do magazynu' });
  const rename = useUpdate('locations', { invalidate: [qk.locations] });
  const setRequired = useUpdate('event_consumables', { invalidate: [qk.eventConsumables] });
  const deleteBox = useAction({ fn: () => rpc('delete_box', { p_box_id: box.id }), invalidate: INVENTORY_KEYS, success: 'Usunięto skrzynię, zawartość wróciła na magazyn' });

  const addItems = async (ids: number[]) => {
    const results = await Promise.allSettled(ids.map((id) => rpc('move_item_to_box', { p_item_id: id, p_box_id: box.id, p_status: 'assigned_to_event' })));
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (failed.length) toast.error(errorMessage(failed[0].reason));
    else toast.success(`Dodano ${ids.length} do skrzyni`);
    await qc.invalidateQueries({ queryKey: qk.items });
  };

  const addConsumable = async ([id]: number[]) => {
    try {
      await rpc('pack_consumable_into_box', { p_box_id: box.id, p_consumable_id: id, p_qty: 0, p_required: Math.max(1, requiredQty) });
      await qc.invalidateQueries({ queryKey: qk.eventConsumables });
      setRequiredQty(1);
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    }
  };

  const removeLine = async (lineId: number, packed: number) => {
    if (packed > 0 && !(await confirm({ title: 'Usunąć pozycję?', description: `Spakowane ${packed} szt. wrócą na stan magazynu.` }))) return;
    try {
      if (packed > 0) await rpc('pack_consumable', { p_ec_id: lineId, p_delta: -packed });
      const { error } = await getSupabase().from('event_consumables').delete().eq('id', lineId);
      if (error) throw error;
      await Promise.all([qc.invalidateQueries({ queryKey: qk.eventConsumables }), qc.invalidateQueries({ queryKey: qk.consumables })]);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const onDeleteBox = async () => {
    if (await confirm({ title: `Usunąć skrzynię „${box.name}”?`, description: 'Sprzęt wróci do swoich miejsc w magazynie, spakowane materiały wrócą na stan.' })) {
      deleteBox.mutate();
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
        {renaming !== null ? (
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (renaming.trim()) rename.mutate({ id: box.id, values: { name: renaming.trim() } });
              setRenaming(null);
            }}
          >
            <Input autoFocus value={renaming} onChange={(e) => setRenaming(e.target.value)} className="h-9" />
            <Button type="submit" size="sm" variant="primary">
              OK
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={() => setRenaming(null)} aria-label="Anuluj">
              <X className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <>
            <h3 className="flex-1 truncate font-semibold text-zinc-50">{box.name}</h3>
            {!readOnly && (
              <>
                <Button size="icon-sm" variant="ghost" onClick={() => setRenaming(box.name)} aria-label="Zmień nazwę">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={onDeleteBox} aria-label="Usuń skrzynię" loading={deleteBox.isPending}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
          </>
        )}
      </div>

      <section className="px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Sprzęt ({boxItems.filter((i) => i.status === 'packed').length}/{boxItems.length})
          </h4>
          {!readOnly && (
            <Button size="sm" variant="ghost" onClick={() => setAddingItems(true)}>
              <Plus className="h-4 w-4" /> Dodaj
            </Button>
          )}
        </div>
        {boxItems.length === 0 ? (
          <p className="py-2 text-sm text-zinc-500">Pusto. Dodaj sprzęt z listy albo zeskanuj etykiety.</p>
        ) : (
          <ul className="space-y-1">
            {boxItems.map((item) => {
              const packed = item.status === 'packed';
              return (
                <li key={item.id} className="flex items-center gap-2">
                  <button
                    disabled={readOnly || togglePack.isPending}
                    onClick={() => togglePack.mutate(item)}
                    className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', packed ? 'text-emerald-400' : 'text-zinc-600 hover:text-zinc-300')}
                    aria-label={packed ? 'Wyjmij ze skrzyni' : 'Oznacz jako spakowany'}
                  >
                    {packed ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                  </button>
                  <button onClick={() => onOpenItem(item)} className="min-w-0 flex-1 text-left">
                    <span className={cn('block truncate text-sm', packed ? 'text-zinc-300' : 'text-zinc-100')}>{item.name}</span>
                    <Mono>{item.sku}</Mono>
                  </button>
                  {!readOnly && (
                    <Button size="icon-sm" variant="ghost" onClick={() => removeItem.mutate(item)} aria-label="Zwróć do magazynu">
                      <Undo2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="border-t border-zinc-800/70 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Materiały</h4>
          {!readOnly && (
            <Button size="sm" variant="ghost" onClick={() => setAddingConsumable(true)}>
              <PackagePlus className="h-4 w-4" /> Dodaj
            </Button>
          )}
        </div>
        {lines.length === 0 ? (
          <p className="py-2 text-sm text-zinc-500">Brak materiałów w tej skrzyni.</p>
        ) : (
          <ul className="space-y-2">
            {lines.map((line) => {
              const c = consumableById.get(line.consumable_id);
              const done = line.quantity_packed >= line.quantity_required;
              return (
                <li key={line.id} className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-100">{c?.name ?? 'Materiał'}</span>
                    <span className="text-xs text-zinc-500">
                      potrzeba{' '}
                      {readOnly ? (
                        line.quantity_required
                      ) : (
                        <input
                          type="number"
                          min={0}
                          defaultValue={line.quantity_required}
                          key={line.quantity_required}
                          onBlur={(e) => {
                            const v = Math.max(0, Number(e.target.value) || 0);
                            if (v !== line.quantity_required) setRequired.mutate({ id: line.id, values: { quantity_required: v } });
                          }}
                          className="w-12 rounded border border-zinc-700 bg-zinc-900 px-1 text-center text-zinc-200"
                        />
                      )}{' '}
                      · w magazynie {c?.quantity_stored ?? 0}
                    </span>
                  </div>
                  {done && <Badge tone="success">OK</Badge>}
                  {line.quantity_returned != null ? (
                    <Badge>zwrócono {line.quantity_returned}</Badge>
                  ) : (
                    <Stepper value={line.quantity_packed} onChange={(d) => pack.mutate({ ec: line, delta: d })} disabled={readOnly} max={line.quantity_packed + (c?.quantity_stored ?? 0)} />
                  )}
                  {!readOnly && line.quantity_returned == null && (
                    <Button size="icon-sm" variant="ghost" onClick={() => removeLine(line.id, line.quantity_packed)} aria-label="Usuń pozycję">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Picker
        open={addingItems}
        onClose={() => setAddingItems(false)}
        title={`Dodaj sprzęt do: ${box.name}`}
        rows={available}
        multiple
        searchText={(i) => [i.name, i.sku, i.barcode, lookups.locationLabel(i.location_id)]}
        render={(i) => (
          <>
            <span className="block truncate text-sm text-zinc-100">{i.name}</span>
            <span className="text-xs text-zinc-500">
              <Mono>{i.sku}</Mono> {lookups.locationLabel(i.location_id) && `· ${lookups.locationLabel(i.location_id)}`}
            </span>
          </>
        )}
        confirmLabel={(n) => `Dodaj ${n}`}
        onConfirm={addItems}
        empty="Brak wolnego sprzętu w warsztacie"
      />
      <Picker
        open={addingConsumable}
        onClose={() => setAddingConsumable(false)}
        title={`Dodaj materiał do: ${box.name}`}
        rows={(consumables.data ?? []).filter((c) => !lines.some((l) => l.consumable_id === c.id))}
        searchText={(c) => [c.name, c.sku, c.barcode]}
        render={(c) => (
          <>
            <span className="block truncate text-sm text-zinc-100">{c.name}</span>
            <span className="text-xs text-zinc-500">
              w magazynie {c.quantity_stored} {c.unit}
            </span>
          </>
        )}
        footerExtra={
          <label className="mr-auto flex items-center gap-2 text-sm text-zinc-400">
            Potrzeba:
            <Input type="number" min={1} value={requiredQty} onChange={(e) => setRequiredQty(Number(e.target.value) || 1)} className="h-9 w-20 text-center" />
          </label>
        }
        onConfirm={addConsumable}
      />
    </Card>
  );
}
