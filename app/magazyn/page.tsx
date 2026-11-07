'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { AlertTriangle, Barcode, Boxes, Link2, MapPin, PackagePlus, Plus, Search, User, Wrench, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useConsumables, useItems } from '@/lib/data/queries';
import { useLookups } from '@/lib/data/lookups';
import { rpc, useAction, useAdjustStock } from '@/lib/data/mutations';
import { qk } from '@/lib/data/keys';
import { ITEM_STATUS, matchesQuery } from '@/lib/format';
import type { Consumable, Item, ItemStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { Badge, EmptyState, ErrorState, ListSkeleton, Mono, PageHeader, Stepper, Tabs } from '@/components/ui/misc';
import { cn } from '@/components/ui/cn';
import { InventoryForm } from '@/components/inventory/item-form';
import { ConsumableDetail, ItemDetail } from '@/components/inventory/details';

type Tab = 'sprzet' | 'materialy';
type SortKey = 'name' | 'sku' | 'location' | 'stock';

type UiState = { tab: Tab; open: number | null; new: 'item' | 'consumable' | null; label: string | null };

/**
 * Deep links (?open=, ?new=, ?label= from the scanner) are read once into
 * local state and stripped from the URL with native replaceState, so the
 * modals' back-gesture handling owns the history stack.
 */
function useWarehouseState() {
  const params = useSearchParams();
  const pathname = usePathname();
  const [state, setState] = useState<UiState>(() => ({
    tab: params.get('tab') === 'materialy' ? 'materialy' : 'sprzet',
    open: null,
    new: null,
    label: null,
  }));

  // adopt a deep link once (state adjustment during render, no effect cascade)
  const deepLink = params.get('open') || params.get('new') || params.get('label') ? params.toString() : null;
  const [adopted, setAdopted] = useState<string | null>(null);
  if (deepLink && deepLink !== adopted) {
    const created = params.get('new');
    setAdopted(deepLink);
    setState({
      tab: params.get('tab') === 'materialy' ? 'materialy' : 'sprzet',
      open: params.get('open') ? Number(params.get('open')) : null,
      new: created === 'item' || created === 'consumable' ? created : null,
      label: params.get('label') || null,
    });
  }
  if (!deepLink && adopted) setAdopted(null); // same link scanned again later must open again

  // keep only ?tab in the address bar
  useEffect(() => {
    const target = state.tab === 'materialy' ? `${pathname}?tab=materialy` : pathname;
    if (window.location.pathname + window.location.search !== target) window.history.replaceState(null, '', target);
  }, [deepLink, state.tab, pathname]);

  const set = (patch: Partial<UiState>) => setState((s) => ({ ...s, ...patch }));
  return [state, set] as const;
}

function Warehouse() {
  const [ui, set] = useWarehouseState();
  const { user } = useAuth();
  const lookups = useLookups();
  const items = useItems();
  const consumables = useConsumables();

  const { tab, open: openId, new: newKind, label: pendingLabel } = ui;

  const [query, setQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('');
  const [status, setStatus] = useState<'' | ItemStatus | 'out'>('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [onlyLow, setOnlyLow] = useState(false);
  const [sort, setSort] = useState<SortKey>('name');

  const assignLabel = useAction({
    fn: (v: { kind: 'item' | 'consumable'; id: number }) => rpc('assign_label', { p_code: pendingLabel!, p_kind: v.kind, p_id: v.id }),
    invalidate: [qk.items, qk.consumables],
    success: `Przypisano etykietę ${pendingLabel}`,
  });

  const filteredItems = useMemo(() => {
    const rows = (items.data ?? []).filter((i) => {
      if (categoryId && String(i.category_id) !== categoryId) return false;
      if (locationId && String(i.location_id) !== locationId) return false;
      if (status === 'out' && !['assigned_to_event', 'packed'].includes(i.status)) return false;
      if (status && status !== 'out' && i.status !== status) return false;
      if (onlyMine && i.responsible_id !== user?.id) return false;
      return matchesQuery(query, i.name, i.sku, i.barcode, i.notes, lookups.person(i.responsible_id)?.display_name, lookups.locationLabel(i.location_id));
    });
    const loc = (i: Item) => lookups.locationLabel(i.location_id) ?? '￿';
    return rows.sort((a, b) =>
      sort === 'sku' ? a.sku.localeCompare(b.sku) : sort === 'location' ? loc(a).localeCompare(loc(b), 'pl') : a.name.localeCompare(b.name, 'pl'),
    );
  }, [items.data, categoryId, locationId, status, onlyMine, query, sort, user?.id, lookups]);

  const filteredConsumables = useMemo(() => {
    const rows = (consumables.data ?? []).filter((c) => {
      if (categoryId && String(c.category_id) !== categoryId) return false;
      if (locationId && String(c.location_id) !== locationId) return false;
      if (onlyLow && !(c.min_quantity > 0 && c.quantity_stored < c.min_quantity)) return false;
      if (onlyMine && c.responsible_id !== user?.id) return false;
      return matchesQuery(query, c.name, c.sku, c.barcode, c.notes, lookups.locationLabel(c.location_id));
    });
    return rows.sort((a, b) =>
      sort === 'sku'
        ? a.sku.localeCompare(b.sku)
        : sort === 'stock'
          ? a.quantity_stored - a.min_quantity - (b.quantity_stored - b.min_quantity)
          : sort === 'location'
            ? (lookups.locationLabel(a.location_id) ?? '￿').localeCompare(lookups.locationLabel(b.location_id) ?? '￿', 'pl')
            : a.name.localeCompare(b.name, 'pl'),
    );
  }, [consumables.data, categoryId, locationId, onlyLow, onlyMine, query, sort, user?.id, lookups]);

  const lowCount = (consumables.data ?? []).filter((c) => c.min_quantity > 0 && c.quantity_stored < c.min_quantity).length;
  const openItem = tab === 'sprzet' && openId ? (items.data?.find((i) => i.id === openId) ?? null) : null;
  const openConsumable = tab === 'materialy' && openId ? (consumables.data?.find((c) => c.id === openId) ?? null) : null;
  const filtersActive = Boolean(query || categoryId || locationId || status || onlyMine || onlyLow);
  const active = tab === 'sprzet' ? items : consumables;

  const onRowClick = (kind: 'item' | 'consumable', id: number) => {
    if (pendingLabel) {
      assignLabel.mutate({ kind, id }, { onSuccess: () => set({ label: null, open: id }) });
      return;
    }
    set({ open: id });
  };

  return (
    <>
      <PageHeader
        title="Magazyn"
        description="Sprzęt trwały i materiały zużywalne koła"
        actions={
          <>
            <Button variant={tab === 'sprzet' ? 'primary' : 'secondary'} onClick={() => set({ new: 'item', tab: 'sprzet' })}>
              <Plus className="h-4 w-4" /> Sprzęt
            </Button>
            <Button variant={tab === 'materialy' ? 'primary' : 'secondary'} onClick={() => set({ new: 'consumable', tab: 'materialy' })}>
              <PackagePlus className="h-4 w-4" /> Materiał
            </Button>
          </>
        }
      />

      {pendingLabel && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-blue-800/60 bg-blue-950/40 p-3 text-sm text-blue-100">
          <Link2 className="h-5 w-5 shrink-0 text-blue-400" />
          <span className="flex-1">
            Wybierz z listy rekord, do którego przypisać etykietę <Mono className="text-blue-200">{pendingLabel}</Mono>.
          </span>
          <Button size="sm" variant="ghost" onClick={() => set({ label: null })}>
            Anuluj
          </Button>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3">
        <Tabs
          value={tab}
          onChange={(v) => set({ tab: v, open: null })}
          options={[
            { value: 'sprzet', label: 'Sprzęt', count: items.data?.length },
            { value: 'materialy', label: lowCount ? <span className="flex items-center gap-1">Materiały <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /></span> : 'Materiały', count: consumables.data?.length },
          ]}
        />
        <div className="flex flex-col gap-2 lg:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj: nazwa, SKU, etykieta, opiekun, miejsce…" className="pl-9" type="search" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="sm:w-44" aria-label="Kategoria">
              <option value="">Wszystkie kategorie</option>
              {lookups.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="sm:w-44" aria-label="Miejsce">
              <option value="">Wszystkie miejsca</option>
              {lookups.permanentLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
            {tab === 'sprzet' ? (
              <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="sm:w-44" aria-label="Status">
                <option value="">Każdy status</option>
                <option value="in_workshop">W warsztacie</option>
                <option value="out">Na wyjeździe</option>
                <option value="missing">Zaginione</option>
                <option value="broken">Uszkodzone</option>
              </Select>
            ) : (
              <Button variant={onlyLow ? 'primary' : 'secondary'} onClick={() => setOnlyLow((v) => !v)}>
                <AlertTriangle className="h-4 w-4" /> Braki {lowCount > 0 && `(${lowCount})`}
              </Button>
            )}
            <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="sm:w-36" aria-label="Sortowanie">
              <option value="name">Nazwa A–Z</option>
              <option value="sku">SKU</option>
              <option value="location">Miejsce</option>
              {tab === 'materialy' && <option value="stock">Najmniejszy zapas</option>}
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOnlyMine((v) => !v)}
            className={cn('flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium', onlyMine ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200')}
          >
            <User className="h-3.5 w-3.5" /> Pod moją opieką
          </button>
          {filtersActive && (
            <button
              onClick={() => {
                setQuery('');
                setCategoryId('');
                setLocationId('');
                setStatus('');
                setOnlyMine(false);
                setOnlyLow(false);
              }}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-3.5 w-3.5" /> Wyczyść filtry
            </button>
          )}
        </div>
      </div>

      {active.isError ? (
        <ErrorState error={active.error} onRetry={() => active.refetch()} />
      ) : active.isPending ? (
        <ListSkeleton />
      ) : tab === 'sprzet' ? (
        filteredItems.length === 0 ? (
          <EmptyState icon={Wrench} title={filtersActive ? 'Nic nie pasuje do filtrów' : 'Brak sprzętu'} action={!filtersActive && <Button variant="primary" onClick={() => set({ new: 'item' })}><Plus className="h-4 w-4" /> Dodaj pierwszy sprzęt</Button>}>
            {!filtersActive && 'Dodaj sprzęt ręcznie albo zeskanuj nową etykietę z rolki.'}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-zinc-800/70 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/30">
            {filteredItems.map((item) => (
              <ItemRow key={item.id} item={item} onClick={() => onRowClick('item', item.id)} assigning={Boolean(pendingLabel)} />
            ))}
          </ul>
        )
      ) : filteredConsumables.length === 0 ? (
        <EmptyState icon={Boxes} title={filtersActive ? 'Nic nie pasuje do filtrów' : 'Brak materiałów'} action={!filtersActive && <Button variant="primary" onClick={() => set({ new: 'consumable' })}><Plus className="h-4 w-4" /> Dodaj materiał</Button>} />
      ) : (
        <ul className="divide-y divide-zinc-800/70 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/30">
          {filteredConsumables.map((c) => (
            <ConsumableRow key={c.id} consumable={c} onClick={() => onRowClick('consumable', c.id)} assigning={Boolean(pendingLabel)} />
          ))}
        </ul>
      )}

      {active.data && filtersActive && (
        <p className="mt-3 text-center text-xs text-zinc-600">
          Pokazano {tab === 'sprzet' ? filteredItems.length : filteredConsumables.length} z {active.data.length}
        </p>
      )}

      <ItemDetail item={openItem} onClose={() => set({ open: null })} />
      <ConsumableDetail consumable={openConsumable} onClose={() => set({ open: null })} />
      <InventoryForm
        kind={newKind === 'consumable' ? 'consumable' : 'item'}
        open={newKind === 'item' || newKind === 'consumable'}
        onClose={() => set({ new: null, label: null })}
        record={null}
        defaults={{ barcode: pendingLabel ?? '' }}
        onSaved={(row) => set({ new: null, label: null, open: row.id, tab: newKind === 'consumable' ? 'materialy' : 'sprzet' })}
      />
    </>
  );
}

function ItemRow({ item, onClick, assigning }: { item: Item; onClick: () => void; assigning: boolean }) {
  const lookups = useLookups();
  const status = ITEM_STATUS[item.status];
  const category = lookups.category(item.category_id);
  const person = lookups.person(item.responsible_id);
  return (
    <li>
      <button onClick={onClick} className={cn('flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-zinc-800/40', assigning && 'hover:bg-blue-950/40')}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate font-medium text-zinc-100">{item.name}</span>
            {item.status !== 'in_workshop' && <Badge tone={status.tone}>{status.label}</Badge>}
            {category && category.code !== 'BK' && <Badge>{category.name}</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500">
            <Mono>{item.sku}</Mono>
            {item.barcode && (
              <span className="flex items-center gap-1">
                <Barcode className="h-3 w-3" />
                <Mono>{item.barcode}</Mono>
              </span>
            )}
            {lookups.locationLabel(item.location_id) && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {lookups.locationLabel(item.location_id)}
              </span>
            )}
            {person && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" /> {person.display_name}
              </span>
            )}
          </div>
        </div>
        {assigning && <Link2 className="h-4 w-4 text-blue-400" />}
      </button>
    </li>
  );
}

function ConsumableRow({ consumable: c, onClick, assigning }: { consumable: Consumable; onClick: () => void; assigning: boolean }) {
  const lookups = useLookups();
  const adjust = useAdjustStock();
  const low = c.min_quantity > 0 && c.quantity_stored < c.min_quantity;
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <button onClick={onClick} className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate font-medium text-zinc-100 hover:underline">{c.name}</span>
          {low && <Badge tone="danger">Braki</Badge>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500">
          <Mono>{c.sku}</Mono>
          {c.barcode && (
            <span className="flex items-center gap-1">
              <Barcode className="h-3 w-3" />
              <Mono>{c.barcode}</Mono>
            </span>
          )}
          {lookups.locationLabel(c.location_id) && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {lookups.locationLabel(c.location_id)}
            </span>
          )}
          {c.min_quantity > 0 && <span>min. {c.min_quantity}</span>}
        </div>
      </button>
      {assigning ? (
        <Link2 className="h-4 w-4 text-blue-400" />
      ) : (
        <div className={cn('rounded-xl', low && 'ring-1 ring-red-500/50')}>
          <Stepper value={c.quantity_stored} onChange={(d) => adjust.mutate({ id: c.id, delta: d })} suffix={c.unit === 'szt.' ? undefined : c.unit} />
        </div>
      )}
    </li>
  );
}

export default function MagazynPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Warehouse />
    </Suspense>
  );
}
