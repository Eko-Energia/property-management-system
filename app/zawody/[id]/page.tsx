'use client';

import { Suspense, use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CalendarDays, MapPin, Package, Pencil, Play, Plus, ScanLine, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { useEventConsumables, useEvents, useItems, useLocations } from '@/lib/data/queries';
import { eventProgress } from '@/lib/data/event-progress';
import { INVENTORY_KEYS, rpc, useAction, useInsert, useUpdate } from '@/lib/data/mutations';
import { qk } from '@/lib/data/keys';
import { errorMessage } from '@/lib/errors';
import { EVENT_STATUS, formatDate } from '@/lib/format';
import type { Item } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/field';
import { Badge, Card, EmptyState, ErrorState, ListSkeleton, Tabs } from '@/components/ui/misc';
import { useConfirm } from '@/components/ui/confirm';
import { cn } from '@/components/ui/cn';
import { ScannerModal, type ScanFeedback } from '@/components/scanner/scanner-modal';
import { ItemDetail } from '@/components/inventory/details';
import { ActivityList } from '@/components/inventory/activity';
import { EventForm } from '@/components/events/event-form';
import { BoxPanel } from '@/components/events/box-panel';
import { Settlement } from '@/components/events/settlement';

type Tab = 'pakowanie' | 'rozliczenie' | 'historia';

function EventView({ eventId }: { eventId: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { isAdmin } = useAuth();
  const events = useEvents();
  const locations = useLocations();
  const items = useItems();
  const ecs = useEventConsumables();

  const event = events.data?.find((e) => e.id === eventId);
  const boxes = (locations.data ?? []).filter((l) => l.kind === 'event_box' && l.event_id === eventId);
  const [tab, setTab] = useState<Tab>('pakowanie');
  const [boxId, setBoxId] = useState<number | null>(null);
  const [newBox, setNewBox] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [feedback, setFeedback] = useState<ScanFeedback>(null);
  const [openItemId, setOpenItemId] = useState<number | null>(null);

  const selectedBox = boxes.find((b) => b.id === boxId) ?? boxes[0] ?? null;
  const readOnly = event?.status === 'closed';
  const progress = eventProgress(eventId, locations.data ?? [], items.data ?? [], ecs.data ?? []);

  // deep link from the global scanner: ?item=ID (adopted during render, URL cleaned in effect)
  const deepItem = params.get('item');
  const [adopted, setAdopted] = useState<string | null>(null);
  if (deepItem && deepItem !== adopted) {
    setAdopted(deepItem);
    setOpenItemId(Number(deepItem));
  }
  if (!deepItem && adopted) setAdopted(null);
  useEffect(() => {
    if (deepItem) window.history.replaceState(null, '', `/zawody/${eventId}`);
  }, [deepItem, eventId]);

  const createBox = useInsert('locations', { invalidate: [qk.locations] });
  const updateEvent = useUpdate('events', { invalidate: [qk.events, qk.stats] });
  const deleteEvent = useAction({
    fn: () => rpc('delete_event', { p_event_id: eventId }),
    invalidate: [...INVENTORY_KEYS, qk.events],
    success: 'Usunięto wyjazd',
  });

  if (events.isError) return <ErrorState error={events.error} onRetry={() => events.refetch()} />;
  if (events.isPending || locations.isPending) return <ListSkeleton rows={4} />;
  if (!event) {
    return (
      <EmptyState icon={Package} title="Nie ma takiego wyjazdu" action={<Link href="/zawody" className="text-sm text-blue-400">Wróć do listy</Link>}>
        Mógł zostać usunięty.
      </EmptyState>
    );
  }

  const status = EVENT_STATUS[event.status];

  const submitBox = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newBox?.trim();
    if (!name) return;
    const created = await createBox.mutateAsync({ name, kind: 'event_box', event_id: eventId });
    setBoxId(created.id);
    setNewBox(null);
  };

  const onScan = async (code: string) => {
    const box = selectedBox;
    if (!box) {
      setFeedback({ tone: 'error', text: 'Najpierw utwórz skrzynię' });
      return;
    }
    try {
      const hits = await rpc('lookup_code', { p_code: code });
      const hit = hits[0];
      if (!hit) {
        setFeedback({ tone: 'error', text: `Nieznana etykieta ${code}` });
        return;
      }
      if (hit.kind === 'item') {
        if (hit.location_id === box.id && hit.item_status === 'packed') {
          setFeedback({ tone: 'info', text: `${hit.name}: już w tej skrzyni` });
          return;
        }
        await rpc('move_item_to_box', { p_item_id: hit.id, p_box_id: box.id, p_status: 'packed' });
        setFeedback({ tone: 'success', text: `✓ ${hit.name} → ${box.name}` });
        await qc.invalidateQueries({ queryKey: qk.items });
      } else {
        const line = await rpc('pack_consumable_into_box', { p_box_id: box.id, p_consumable_id: hit.id, p_qty: 1 });
        setFeedback({ tone: 'success', text: `+1 ${hit.name} (${line.quantity_packed}/${line.quantity_required})` });
        await Promise.all([qc.invalidateQueries({ queryKey: qk.eventConsumables }), qc.invalidateQueries({ queryKey: qk.consumables })]);
      }
    } catch (err) {
      setFeedback({ tone: 'error', text: errorMessage(err) });
    }
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: `Usunąć wyjazd „${event.name}”?`,
      description: 'Skrzynie zostaną usunięte, sprzęt wróci do magazynu, a spakowane materiały na stan. Historia zmian zostaje.',
    });
    if (ok) {
      await deleteEvent.mutateAsync();
      router.replace('/zawody');
    }
  };

  const openItem: Item | null = openItemId ? (items.data?.find((i) => i.id === openItemId) ?? null) : null;

  return (
    <>
      <Link href="/zawody" className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300">
        <ArrowLeft className="h-4 w-4" /> Wyjazdy
      </Link>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{event.name}</h1>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 text-sm text-zinc-500">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-4 w-4" /> {formatDate(event.start_date)}
              {event.end_date && ` – ${formatDate(event.end_date)}`}
            </span>
            {event.place && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" /> {event.place}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {event.status === 'planning' && (
            <Button variant="success" onClick={() => updateEvent.mutate({ id: event.id, values: { status: 'active' } })} loading={updateEvent.isPending}>
              <Play className="h-4 w-4" /> Wyruszamy
            </Button>
          )}
          {!readOnly && (
            <Button size="icon" onClick={() => setEditing(true)} aria-label="Edytuj wyjazd">
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {isAdmin && (
            <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Usuń wyjazd" loading={deleteEvent.isPending}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {!readOnly && (
        <Card className="mb-5 p-4">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-zinc-300">
              Spakowano {progress.itemsPacked}/{progress.items} sprzętu · {progress.consumablesDone}/{progress.consumableLines} materiałów
            </span>
            <span className="font-semibold text-zinc-100">{Math.round(progress.ratio * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress.ratio * 100}%` }} />
          </div>
        </Card>
      )}

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'pakowanie', label: 'Pakowanie' },
          { value: 'rozliczenie', label: readOnly ? 'Rozliczenie' : 'Powrót i rozliczenie' },
          { value: 'historia', label: 'Historia' },
        ]}
      />

      {tab === 'pakowanie' && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {boxes.map((b) => (
              <button
                key={b.id}
                onClick={() => setBoxId(b.id)}
                className={cn(
                  'rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors',
                  selectedBox?.id === b.id ? 'border-blue-500 bg-blue-600/15 text-blue-200' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200',
                )}
              >
                {b.name}
              </button>
            ))}
            {!readOnly &&
              (newBox !== null ? (
                <form onSubmit={submitBox} className="flex gap-2">
                  <Input autoFocus value={newBox} onChange={(e) => setNewBox(e.target.value)} placeholder="Nazwa skrzyni" className="h-9 w-44" maxLength={80} />
                  <Button type="submit" size="sm" variant="primary" loading={createBox.isPending}>
                    Dodaj
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setNewBox(null)}>
                    Anuluj
                  </Button>
                </form>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setNewBox(`Skrzynia ${boxes.length + 1}`)}>
                  <Plus className="h-4 w-4" /> Skrzynia
                </Button>
              ))}
          </div>

          {boxes.length === 0 ? (
            <EmptyState icon={Package} title="Brak skrzyń" action={!readOnly && <Button variant="primary" onClick={() => setNewBox('Skrzynia 1')}><Plus className="h-4 w-4" /> Dodaj skrzynię</Button>}>
              Skrzynia to fizyczne pudło, do którego pakujecie sprzęt i materiały.
            </EmptyState>
          ) : (
            <>
              {!readOnly && selectedBox && (
                <Button variant="primary" size="lg" className="mb-4 w-full sm:w-auto" onClick={() => { setFeedback(null); setScanning(true); }}>
                  <ScanLine className="h-5 w-5" /> Skanuj do: {selectedBox.name}
                </Button>
              )}
              {selectedBox && <BoxPanel box={selectedBox} readOnly={readOnly} onOpenItem={(i) => setOpenItemId(i.id)} />}
            </>
          )}
        </>
      )}

      {tab === 'rozliczenie' && <Settlement event={event} boxes={boxes} />}

      {tab === 'historia' && (
        <Card className="p-4">
          <ActivityList table="events" rowId={event.id} />
        </Card>
      )}

      <ScannerModal
        open={scanning}
        onClose={() => setScanning(false)}
        onScan={onScan}
        mode="continuous"
        title="Pakowanie skanerem"
        hint="Sprzęt: pakuje się od razu. Materiał: +1 szt. na skan."
        feedback={feedback}
        footer={
          boxes.length > 1 && (
            <Select value={selectedBox?.id ?? ''} onChange={(e) => setBoxId(Number(e.target.value))} aria-label="Skrzynia docelowa" className="bg-zinc-900">
              {boxes.map((b) => (
                <option key={b.id} value={b.id}>
                  Skrzynia: {b.name}
                </option>
              ))}
            </Select>
          )
        }
      />
      <ItemDetail item={openItem} onClose={() => setOpenItemId(null)} />
      <EventForm open={editing} onClose={() => setEditing(false)} record={event} />
    </>
  );
}

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<ListSkeleton rows={4} />}>
      <EventView eventId={Number(id)} />
    </Suspense>
  );
}
