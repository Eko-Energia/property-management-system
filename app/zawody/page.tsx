'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, MapPin, Plane, Plus } from 'lucide-react';
import { useEventConsumables, useEvents, useItems, useLocations } from '@/lib/data/queries';
import { eventProgress } from '@/lib/data/event-progress';
import { EVENT_STATUS, formatDate } from '@/lib/format';
import type { InventoryEvent } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge, Card, EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/ui/misc';
import { EventForm } from '@/components/events/event-form';

export default function EventsPage() {
  const events = useEvents();
  const [creating, setCreating] = useState(false);
  const open = (events.data ?? []).filter((e) => e.status !== 'closed');
  const closed = (events.data ?? []).filter((e) => e.status === 'closed');

  return (
    <>
      <PageHeader
        title="Wyjazdy"
        description="Zawody i wyjazdy: skrzynie, pakowanie, rozliczenie po powrocie"
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nowy wyjazd
          </Button>
        }
      />

      {events.isError ? (
        <ErrorState error={events.error} onRetry={() => events.refetch()} />
      ) : events.isPending ? (
        <ListSkeleton rows={3} />
      ) : events.data.length === 0 ? (
        <EmptyState icon={Plane} title="Brak wyjazdów" action={<Button variant="primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Zaplanuj pierwszy wyjazd</Button>}>
          Utwórz wyjazd, dodaj skrzynie i pakuj sprzęt skanerem.
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {open.length > 0 && (
            <section className="grid gap-3 md:grid-cols-2">
              {open.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </section>
          )}
          {closed.length > 0 && (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Zakończone</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {closed.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
      <EventForm open={creating} onClose={() => setCreating(false)} record={null} />
    </>
  );
}

function EventCard({ event }: { event: InventoryEvent }) {
  const locations = useLocations();
  const items = useItems();
  const ecs = useEventConsumables();
  const p = eventProgress(event.id, locations.data ?? [], items.data ?? [], ecs.data ?? []);
  const status = EVENT_STATUS[event.status];

  return (
    <Link href={`/zawody/${event.id}`}>
      <Card className="h-full p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-900">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-zinc-50">{event.name}</h3>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" /> {formatDate(event.start_date)}
            {event.end_date && ` – ${formatDate(event.end_date)}`}
          </span>
          {event.place && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {event.place}
            </span>
          )}
        </div>
        {event.status !== 'closed' && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-zinc-400">
              <span>
                {p.boxes} skrz. · {p.itemsPacked}/{p.items} sprzętu · {p.consumablesDone}/{p.consumableLines} materiałów
              </span>
              <span>{Math.round(p.ratio * 100)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${p.ratio * 100}%` }} />
            </div>
          </div>
        )}
      </Card>
    </Link>
  );
}
