'use client';

import { useMemo, useState } from 'react';
import { Bot, Check, ExternalLink, PackageCheck, Pencil, Plus, ShoppingCart, Trash2, Truck, X } from 'lucide-react';
import { useConsumables, useShoppingList } from '@/lib/data/queries';
import { useLookups } from '@/lib/data/lookups';
import { INVENTORY_KEYS, rpc, useAction, useDelete, useInsert, useUpdate } from '@/lib/data/mutations';
import { qk } from '@/lib/data/keys';
import { formatPln, formatRelative, hostLabel, safeUrl, SHOPPING_STATUS } from '@/lib/format';
import type { ShoppingItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Badge, Card, EmptyState, ErrorState, ListSkeleton, PageHeader, Tabs } from '@/components/ui/misc';
import { Modal } from '@/components/ui/modal';
import { useConfirm } from '@/components/ui/confirm';
import { CategorySelect, LocationSelect } from '@/components/inventory/pickers';

type Tab = 'pending' | 'ordered' | 'history';
const SHOPPING_KEYS = [qk.shopping, qk.stats];

export default function ShoppingPage() {
  const shopping = useShoppingList();
  const consumables = useConsumables();
  const [tab, setTab] = useState<Tab>('pending');
  const [editing, setEditing] = useState<ShoppingItem | 'new' | null>(null);
  const [receiving, setReceiving] = useState<ShoppingItem | null>(null);

  const rows = useMemo(() => shopping.data ?? [], [shopping.data]);
  const byTab = useMemo(
    () => ({
      pending: rows.filter((r) => r.status === 'pending'),
      ordered: rows.filter((r) => r.status === 'ordered'),
      history: rows.filter((r) => r.status === 'received' || r.status === 'cancelled'),
    }),
    [rows],
  );
  const cost = (list: ShoppingItem[]) => list.reduce((s, r) => s + (r.price_estimate ?? 0) * r.quantity, 0);

  // low stock without an open request (auto-requests cover most; this catches min changes etc.)
  const uncovered = (consumables.data ?? []).filter(
    (c) => c.min_quantity > 0 && c.quantity_stored < c.min_quantity && !rows.some((r) => r.consumable_id === c.id && (r.status === 'pending' || r.status === 'ordered')),
  );
  const request = useInsert('shopping_list', { invalidate: SHOPPING_KEYS, success: 'Dodano do listy' });

  return (
    <>
      <PageHeader
        title="Zakupy"
        description="Braki w magazynie trafiają tu automatycznie. Dorzuć własne zgłoszenia, oznacz zamówione, przyjmij dostawę."
        actions={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> Zgłoś zakup
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-zinc-500">Do zamówienia</p>
          <p className="mt-1 text-xl font-semibold text-zinc-50">{formatPln(cost(byTab.pending))}</p>
          <p className="text-xs text-zinc-500">{byTab.pending.length} pozycji</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-zinc-500">W drodze</p>
          <p className="mt-1 text-xl font-semibold text-zinc-50">{formatPln(cost(byTab.ordered))}</p>
          <p className="text-xs text-zinc-500">{byTab.ordered.length} pozycji</p>
        </Card>
        <Card className="col-span-2 p-4 sm:col-span-1">
          <p className="text-xs text-zinc-500">Łącznie otwarte</p>
          <p className="mt-1 text-xl font-semibold text-zinc-50">{formatPln(cost([...byTab.pending, ...byTab.ordered]))}</p>
          <p className="text-xs text-zinc-500">szacunkowo, wg podanych cen</p>
        </Card>
      </div>

      {uncovered.length > 0 && (
        <Card className="mb-5 border-amber-900/50 bg-amber-950/20 p-4">
          <p className="mb-2 text-sm font-medium text-amber-200">Braki bez zgłoszenia</p>
          <ul className="space-y-2">
            {uncovered.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-200">
                  {c.name}{' '}
                  <span className="text-zinc-500">
                    ({c.quantity_stored}/{c.min_quantity} {c.unit})
                  </span>
                </span>
                <Button
                  size="sm"
                  onClick={() =>
                    request.mutate({
                      name: c.name,
                      kind: 'consumable',
                      quantity: Math.max(c.min_quantity * 2 - c.quantity_stored, 1),
                      consumable_id: c.id,
                      category_id: c.category_id,
                      shop_link: c.shop_link,
                    })
                  }
                >
                  <ShoppingCart className="h-4 w-4" /> Zamów
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'pending', label: 'Do zamówienia', count: byTab.pending.length },
          { value: 'ordered', label: 'Zamówione', count: byTab.ordered.length },
          { value: 'history', label: 'Historia' },
        ]}
      />

      {shopping.isError ? (
        <ErrorState error={shopping.error} onRetry={() => shopping.refetch()} />
      ) : shopping.isPending ? (
        <ListSkeleton rows={4} />
      ) : byTab[tab].length === 0 ? (
        <EmptyState icon={ShoppingCart} title={tab === 'history' ? 'Brak historii' : 'Pusto'}>
          {tab === 'pending' && 'Nic nie czeka na zamówienie.'}
          {tab === 'ordered' && 'Nic nie jest w drodze.'}
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {byTab[tab].map((row) => (
            <ShoppingRow key={row.id} row={row} onEdit={() => setEditing(row)} onReceive={() => setReceiving(row)} />
          ))}
        </ul>
      )}

      <RequestForm open={editing !== null} record={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      <ReceiveDialog row={receiving} onClose={() => setReceiving(null)} />
    </>
  );
}

function ShoppingRow({ row, onEdit, onReceive }: { row: ShoppingItem; onEdit: () => void; onReceive: () => void }) {
  const lookups = useLookups();
  const confirm = useConfirm();
  const update = useUpdate('shopping_list', { invalidate: SHOPPING_KEYS });
  const remove = useDelete('shopping_list', { invalidate: SHOPPING_KEYS, success: 'Usunięto zgłoszenie' });
  const link = safeUrl(row.shop_link);
  const status = SHOPPING_STATUS[row.status];
  const open = row.status === 'pending' || row.status === 'ordered';

  return (
    <li>
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-zinc-100">{row.name}</span>
            <Badge>{row.kind === 'item' ? 'Sprzęt' : 'Materiał'}</Badge>
            {row.is_auto && (
              <Badge tone="info">
                <Bot className="h-3 w-3" /> auto
              </Badge>
            )}
            {!open && <Badge tone={status.tone}>{status.label}</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500">
            <span className="font-medium text-zinc-300">{row.quantity} szt.</span>
            {row.price_estimate != null && (
              <span>
                {formatPln(row.price_estimate)} / szt. · razem {formatPln(row.price_estimate * row.quantity)}
              </span>
            )}
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-400 hover:underline">
                {hostLabel(link)} <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <span>
              {row.is_auto ? 'system' : (lookups.person(row.requested_by)?.display_name ?? '—')} · {formatRelative(row.created_at)}
            </span>
          </div>
          {row.notes && <p className="mt-1 text-xs text-zinc-400">{row.notes}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {row.status === 'pending' && (
            <Button size="sm" onClick={() => update.mutate({ id: row.id, values: { status: 'ordered' } })} loading={update.isPending}>
              <Truck className="h-4 w-4" /> Zamówione
            </Button>
          )}
          {open && (
            <Button size="sm" variant="success" onClick={onReceive}>
              <PackageCheck className="h-4 w-4" /> Przyjmij
            </Button>
          )}
          {open && (
            <Button size="icon-sm" variant="ghost" onClick={onEdit} aria-label="Edytuj">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {open ? (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Anuluj zgłoszenie"
              onClick={async () => {
                if (await confirm({ title: 'Anulować zgłoszenie?', description: row.name, confirmLabel: 'Anuluj zgłoszenie' })) {
                  update.mutate({ id: row.id, values: { status: 'cancelled' } });
                }
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Usuń z historii"
              onClick={async () => {
                if (await confirm({ title: 'Usunąć z historii?', description: row.name })) remove.mutate(row.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Card>
    </li>
  );
}

function RequestForm({ open, record, onClose }: { open: boolean; record: ShoppingItem | null; onClose: () => void }) {
  const lookups = useLookups();
  const consumables = useConsumables();
  const insert = useInsert('shopping_list', { invalidate: SHOPPING_KEYS, success: 'Dodano zgłoszenie' });
  const update = useUpdate('shopping_list', { invalidate: SHOPPING_KEYS, success: 'Zapisano' });
  const [form, setForm] = useState({ name: '', kind: 'consumable' as 'item' | 'consumable', quantity: 1, price: '', link: '', notes: '', category_id: null as number | null, consumable_id: null as number | null });
  const [seed, setSeed] = useState<number | 'new' | null>(null);

  const key = record?.id ?? 'new';
  if (open && seed !== key) {
    setSeed(key);
    setForm({
      name: record?.name ?? '',
      kind: record?.kind ?? 'consumable',
      quantity: record?.quantity ?? 1,
      price: record?.price_estimate != null ? String(record.price_estimate) : '',
      link: record?.shop_link ?? '',
      notes: record?.notes ?? '',
      category_id: record?.category_id ?? lookups.defaultCategoryId,
      consumable_id: record?.consumable_id ?? null,
    });
  }
  if (!open && seed !== null) setSeed(null);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = form.price.trim() ? Number(form.price.replace(',', '.')) : null;
    const values = {
      name: form.name.trim(),
      kind: form.kind,
      quantity: Math.max(1, Math.floor(form.quantity)),
      price_estimate: price != null && Number.isFinite(price) ? price : null,
      shop_link: form.link.trim() || null,
      notes: form.notes.trim() || null,
      category_id: form.category_id,
      consumable_id: form.kind === 'consumable' ? form.consumable_id : null,
    };
    if (record) await update.mutateAsync({ id: record.id, values });
    else await insert.mutateAsync(values);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={record ? 'Edytuj zgłoszenie' : 'Zgłoś zakup'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Anuluj
          </Button>
          <Button variant="primary" type="submit" form="request-form" loading={insert.isPending || update.isPending} disabled={!form.name.trim()}>
            Zapisz
          </Button>
        </>
      }
    >
      <form id="request-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Typ" className="sm:col-span-2">
          {() => (
            <Tabs
              className="grid grid-cols-2"
              value={form.kind}
              onChange={(v) => set('kind', v)}
              options={[
                { value: 'consumable', label: 'Materiał' },
                { value: 'item', label: 'Sprzęt' },
              ]}
            />
          )}
        </Field>
        {form.kind === 'consumable' && (
          <Field label="Uzupełnienie istniejącego materiału" hint="Po przyjęciu stan tego materiału wzrośnie. Puste = nowy materiał." className="sm:col-span-2">
            {(id) => (
              <Select
                id={id}
                value={form.consumable_id ?? ''}
                onChange={(e) => {
                  const c = consumables.data?.find((x) => x.id === Number(e.target.value));
                  setForm((f) => ({ ...f, consumable_id: c?.id ?? null, name: c?.name ?? f.name, link: c?.shop_link ?? f.link, category_id: c?.category_id ?? f.category_id }));
                }}
              >
                <option value="">— nowy materiał —</option>
                {consumables.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.quantity_stored} {c.unit})
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Field label="Nazwa" required className="sm:col-span-2">
          {(id) => <Input id={id} value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={120} />}
        </Field>
        <Field label="Ilość">
          {(id) => <Input id={id} type="number" inputMode="numeric" min={1} value={form.quantity} onChange={(e) => set('quantity', Number(e.target.value) || 1)} />}
        </Field>
        <Field label="Cena za sztukę (zł)">
          {(id) => <Input id={id} inputMode="decimal" value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="np. 12,50" />}
        </Field>
        <Field label="Kategoria">
          {(id) => <CategorySelect id={id} lookups={lookups} value={form.category_id} onChange={(v) => set('category_id', v)} />}
        </Field>
        <Field label="Link do sklepu">
          {(id) => <Input id={id} type="url" value={form.link} onChange={(e) => set('link', e.target.value)} placeholder="https://…" />}
        </Field>
        <Field label="Uzasadnienie / uwagi" className="sm:col-span-2">
          {(id) => <Textarea id={id} value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />}
        </Field>
      </form>
    </Modal>
  );
}

function ReceiveDialog({ row, onClose }: { row: ShoppingItem | null; onClose: () => void }) {
  const lookups = useLookups();
  const [locationId, setLocationId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const receive = useAction({
    fn: (r: ShoppingItem) => rpc('receive_purchase', { p_id: r.id, p_location_id: locationId, p_category_id: categoryId ?? r.category_id }),
    invalidate: [...INVENTORY_KEYS, ...SHOPPING_KEYS],
    success: (_, r) => (r.kind === 'item' ? `Dodano ${r.quantity} szt. sprzętu do magazynu` : 'Stan magazynu zaktualizowany'),
  });

  if (!row) return null;
  const restock = row.kind === 'consumable' && row.consumable_id != null;

  return (
    <Modal
      open
      onClose={onClose}
      title="Przyjmij dostawę"
      description={`${row.name} · ${row.quantity} szt.`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Anuluj
          </Button>
          <Button variant="success" loading={receive.isPending} onClick={() => receive.mutate(row, { onSuccess: onClose })}>
            <Check className="h-4 w-4" /> Przyjmij
          </Button>
        </>
      }
    >
      {restock ? (
        <p className="text-sm text-zinc-300">
          Stan materiału <b>{row.name}</b> wzrośnie o {row.quantity}.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-zinc-400">
            {row.kind === 'item'
              ? `Powstanie ${row.quantity} ${row.quantity === 1 ? 'nowy rekord' : 'nowych rekordów'} sprzętu z automatycznym SKU. Etykiety przypiszesz skanerem.`
              : 'Powstanie nowy materiał w magazynie.'}
          </p>
          <Field label="Kategoria">
            {(id) => <CategorySelect id={id} lookups={lookups} value={categoryId ?? row.category_id} onChange={setCategoryId} />}
          </Field>
          <Field label="Gdzie odłożyć">
            {(id) => <LocationSelect id={id} lookups={lookups} value={locationId} onChange={setLocationId} />}
          </Field>
        </div>
      )}
    </Modal>
  );
}
