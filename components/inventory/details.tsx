'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertOctagon, ExternalLink, Pencil, ShoppingCart, Trash2, Undo2, Wrench } from 'lucide-react';
import { useLookups } from '@/lib/data/lookups';
import { useEventConsumables, useShoppingList } from '@/lib/data/queries';
import { INVENTORY_KEYS, rpc, useAction, useAdjustStock, useDelete, useInsert } from '@/lib/data/mutations';
import { qk } from '@/lib/data/keys';
import { hostLabel, ITEM_STATUS, safeUrl } from '@/lib/format';
import type { Consumable, Item } from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Badge, Mono, Stepper } from '@/components/ui/misc';
import { Input } from '@/components/ui/field';
import { useConfirm } from '@/components/ui/confirm';
import { ActivityList } from './activity';
import { InventoryForm } from './item-form';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right text-zinc-200">{children ?? <span className="text-zinc-600">—</span>}</dd>
    </div>
  );
}

function LinkValue({ url }: { url: string | null }) {
  const safe = safeUrl(url);
  if (!safe) return null;
  return (
    <a href={safe} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-400 hover:underline">
      {hostLabel(safe)} <ExternalLink className="h-3 w-3" />
    </a>
  );
}

export function ItemDetail({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const lookups = useLookups();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);

  const returnItem = useAction({ fn: (id: number) => rpc('return_item', { p_item_id: id }), invalidate: INVENTORY_KEYS, success: 'Zwrócono do magazynu' });
  const markItem = useAction({
    fn: (v: { id: number; status: 'missing' | 'broken' }) => rpc('mark_item', { p_item_id: v.id, p_status: v.status }),
    invalidate: INVENTORY_KEYS,
    success: (_, v) => (v.status === 'missing' ? 'Oznaczono jako zaginiony' : 'Oznaczono jako uszkodzony'),
  });
  const remove = useDelete('items', { invalidate: INVENTORY_KEYS, success: 'Usunięto sprzęt' });

  if (!item) return null;
  const status = ITEM_STATUS[item.status];
  const location = lookups.location(item.location_id);
  const event = location?.kind === 'event_box' ? lookups.event(location.event_id) : undefined;
  const category = lookups.category(item.category_id);

  const onDelete = async () => {
    const ok = await confirm({
      title: `Usunąć ${item.name}?`,
      description: 'Rekord zniknie z inwentarza. Zmiana zostaje w historii, ale etykieta zostanie zwolniona.',
    });
    if (!ok) return;
    await remove.mutateAsync(item.id);
    onClose();
  };

  return (
    <>
      <Modal
        open={!editing}
        onClose={onClose}
        title={item.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Mono>{item.sku}</Mono>
            <Badge tone={status.tone}>{status.label}</Badge>
          </span>
        }
        footer={
          <>
            <Button variant="ghost" size="sm" className="mr-auto text-red-400 hover:text-red-300" onClick={onDelete} loading={remove.isPending}>
              <Trash2 className="h-4 w-4" /> Usuń
            </Button>
            <Button size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Edytuj
            </Button>
          </>
        }
      >
        <dl className="divide-y divide-zinc-800/70">
          <Row label="Miejsce">
            {lookups.locationLabel(item.location_id)}
            {event && (
              <Link href={`/zawody/${event.id}`} className="ml-2 text-xs text-blue-400 hover:underline">
                otwórz wyjazd
              </Link>
            )}
          </Row>
          {item.home_location_id && item.home_location_id !== item.location_id && <Row label="Wraca do">{lookups.locationLabel(item.home_location_id)}</Row>}
          <Row label="Kategoria">{category ? `${category.name} (${category.code})` : null}</Row>
          <Row label="Etykieta">{item.barcode ? <Mono className="text-zinc-200">{item.barcode}</Mono> : null}</Row>
          <Row label="Opiekun">{lookups.person(item.responsible_id)?.display_name}</Row>
          <Row label="Sklep">
            <LinkValue url={item.shop_link} />
          </Row>
          {item.notes && <Row label="Notatki">{<span className="whitespace-pre-wrap">{item.notes}</span>}</Row>}
        </dl>

        <div className="mt-4 flex flex-wrap gap-2">
          {item.status !== 'in_workshop' && (
            <Button size="sm" variant="success" onClick={() => returnItem.mutate(item.id)} loading={returnItem.isPending}>
              <Undo2 className="h-4 w-4" /> Zwróć do magazynu
            </Button>
          )}
          {item.status !== 'missing' && (
            <Button size="sm" variant="ghost" onClick={() => markItem.mutate({ id: item.id, status: 'missing' })}>
              <AlertOctagon className="h-4 w-4" /> Zaginiony
            </Button>
          )}
          {item.status !== 'broken' && (
            <Button size="sm" variant="ghost" onClick={() => markItem.mutate({ id: item.id, status: 'broken' })}>
              <Wrench className="h-4 w-4" /> Uszkodzony
            </Button>
          )}
        </div>

        <h3 className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-zinc-500">Historia</h3>
        <ActivityList table="items" rowId={item.id} />
      </Modal>
      <InventoryForm kind="item" open={editing} onClose={() => setEditing(false)} record={item} />
    </>
  );
}

export function ConsumableDetail({ consumable, onClose }: { consumable: Consumable | null; onClose: () => void }) {
  const lookups = useLookups();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const adjust = useAdjustStock();
  const shopping = useShoppingList();
  const eventConsumables = useEventConsumables();
  const remove = useDelete('consumables', { invalidate: INVENTORY_KEYS, success: 'Usunięto materiał' });
  const request = useInsert('shopping_list', { invalidate: [qk.shopping, qk.stats], success: 'Dodano do listy zakupów' });

  if (!consumable) return null;
  const low = consumable.min_quantity > 0 && consumable.quantity_stored < consumable.min_quantity;
  const openRequest = shopping.data?.find((s) => s.consumable_id === consumable.id && (s.status === 'pending' || s.status === 'ordered'));
  const packedOut = (eventConsumables.data ?? []).filter((ec) => ec.consumable_id === consumable.id && ec.quantity_returned == null && ec.quantity_packed > 0);

  const applyAmount = (sign: 1 | -1) => {
    const n = Math.floor(Number(amount));
    if (!n || n < 1) return;
    adjust.mutate({ id: consumable.id, delta: sign * n });
    setAmount('');
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: `Usunąć ${consumable.name}?`,
      description: packedOut.length
        ? 'Uwaga: materiał jest spakowany na wyjazd. Usunięcie skasuje też te pozycje.'
        : 'Rekord zniknie z magazynu (zostaje w historii).',
    });
    if (!ok) return;
    await remove.mutateAsync(consumable.id);
    onClose();
  };

  return (
    <>
      <Modal
        open={!editing}
        onClose={onClose}
        title={consumable.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Mono>{consumable.sku}</Mono>
            {low && <Badge tone="danger">Poniżej minimum</Badge>}
          </span>
        }
        footer={
          <>
            <Button variant="ghost" size="sm" className="mr-auto text-red-400 hover:text-red-300" onClick={onDelete} loading={remove.isPending}>
              <Trash2 className="h-4 w-4" /> Usuń
            </Button>
            <Button size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Edytuj
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Stan w magazynie</p>
          <Stepper value={consumable.quantity_stored} onChange={(d) => adjust.mutate({ id: consumable.id, delta: d })} suffix={consumable.unit} />
          <div className="flex w-full max-w-xs gap-2">
            <Input type="number" inputMode="numeric" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ilość" className="text-center" />
            <Button size="md" variant="success" onClick={() => applyAmount(1)} disabled={!amount}>
              Przyjmij
            </Button>
            <Button size="md" onClick={() => applyAmount(-1)} disabled={!amount}>
              Wydaj
            </Button>
          </div>
          <p className="text-xs text-zinc-500">
            Minimum: {consumable.min_quantity} {consumable.unit}
            {packedOut.length > 0 && ` · na wyjazdach: ${packedOut.reduce((s, r) => s + r.quantity_packed, 0)}`}
          </p>
        </div>

        <dl className="mt-3 divide-y divide-zinc-800/70">
          <Row label="Miejsce">{lookups.locationLabel(consumable.location_id)}</Row>
          <Row label="Kategoria">{lookups.category(consumable.category_id)?.name}</Row>
          <Row label="Etykieta">{consumable.barcode ? <Mono className="text-zinc-200">{consumable.barcode}</Mono> : null}</Row>
          <Row label="Opiekun">{lookups.person(consumable.responsible_id)?.display_name}</Row>
          <Row label="Sklep">
            <LinkValue url={consumable.shop_link} />
          </Row>
          {consumable.notes && <Row label="Notatki">{<span className="whitespace-pre-wrap">{consumable.notes}</span>}</Row>}
        </dl>

        <div className="mt-4">
          {openRequest ? (
            <Link href="/zakupy" className="inline-flex items-center gap-1.5 text-sm text-amber-300 hover:underline">
              <ShoppingCart className="h-4 w-4" /> Jest już na liście zakupów ({openRequest.quantity} {consumable.unit}
              {openRequest.is_auto ? ', automatycznie' : ''})
            </Link>
          ) : (
            <Button
              size="sm"
              onClick={() =>
                request.mutate({
                  name: consumable.name,
                  kind: 'consumable',
                  quantity: Math.max(consumable.min_quantity * 2 - consumable.quantity_stored, 1),
                  consumable_id: consumable.id,
                  category_id: consumable.category_id,
                  shop_link: consumable.shop_link,
                })
              }
              loading={request.isPending}
            >
              <ShoppingCart className="h-4 w-4" /> Dodaj do zakupów
            </Button>
          )}
        </div>

        <h3 className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wider text-zinc-500">Historia</h3>
        <ActivityList table="consumables" rowId={consumable.id} />
      </Modal>
      <InventoryForm kind="consumable" open={editing} onClose={() => setEditing(false)} record={consumable} />
    </>
  );
}
