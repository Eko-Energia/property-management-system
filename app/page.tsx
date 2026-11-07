'use client';

import Link from 'next/link';
import { AlertTriangle, ArrowRight, Boxes, PackageSearch, Plane, ShoppingCart, Wrench } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useConsumables, useEventConsumables, useEvents, useItems, useLocations, useStats } from '@/lib/data/queries';
import { eventProgress } from '@/lib/data/event-progress';
import { EVENT_STATUS, formatDate, formatPln } from '@/lib/format';
import { Badge, Card, Skeleton } from '@/components/ui/misc';
import { cn } from '@/components/ui/cn';
import { ActivityList } from '@/components/inventory/activity';

function StatTile({ href, label, value, sub, icon: Icon, tone = 'neutral' }: { href: string; label: string; value: number | string | undefined; sub?: string; icon: typeof Boxes; tone?: 'neutral' | 'warning' | 'danger' }) {
  return (
    <Link href={href}>
      <Card className="h-full p-4 transition-colors hover:border-zinc-700 hover:bg-zinc-900">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-500">{label}</span>
          <Icon className={cn('h-4 w-4', tone === 'warning' ? 'text-amber-400' : tone === 'danger' ? 'text-red-400' : 'text-zinc-600')} />
        </div>
        {value === undefined ? <Skeleton className="mt-2 h-7 w-12" /> : <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-50">{value}</p>}
        {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
      </Card>
    </Link>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();
  const stats = useStats();
  const consumables = useConsumables();
  const events = useEvents();
  const locations = useLocations();
  const items = useItems();
  const ecs = useEventConsumables();
  const s = stats.data;

  const low = (consumables.data ?? [])
    .filter((c) => c.min_quantity > 0 && c.quantity_stored < c.min_quantity)
    .sort((a, b) => a.quantity_stored / a.min_quantity - b.quantity_stored / b.min_quantity)
    .slice(0, 6);
  const activeEvents = (events.data ?? []).filter((e) => e.status !== 'closed').slice(0, 3);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Cześć, {profile?.display_name.split(' ')[0]} 👋</h1>
        <p className="mt-1 text-sm text-zinc-400">Stan magazynu koła w jednym miejscu.</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile href="/magazyn" label="Sprzęt" value={s?.items} sub={s ? `${s.items_out} na wyjazdach` : undefined} icon={Wrench} />
        <StatTile href="/magazyn?tab=materialy" label="Materiały" value={s?.consumables} sub={s && s.low_stock > 0 ? `${s.low_stock} poniżej minimum` : 'zapasy OK'} icon={Boxes} tone={s && s.low_stock > 0 ? 'warning' : 'neutral'} />
        <StatTile href="/zawody" label="Aktywne wyjazdy" value={s?.active_events} icon={Plane} />
        <StatTile href="/zakupy" label="Otwarte zakupy" value={s?.open_purchases} sub={s ? formatPln(s.purchases_cost) : undefined} icon={ShoppingCart} />
      </div>

      {s && s.items_problem > 0 && (
        <Link href="/magazyn" className="mb-6 flex items-center gap-3 rounded-2xl border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-200 hover:bg-red-950/50">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
          <span className="flex-1">
            {s.items_problem} {s.items_problem === 1 ? 'przedmiot jest oznaczony' : 'przedmiotów jest oznaczonych'} jako zaginione lub uszkodzone.
          </span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-zinc-100">Wyjazdy w toku</h2>
              <Link href="/zawody" className="text-xs text-blue-400 hover:underline">
                wszystkie
              </Link>
            </div>
            {activeEvents.length === 0 ? (
              <p className="text-sm text-zinc-500">Brak zaplanowanych wyjazdów.</p>
            ) : (
              <ul className="space-y-3">
                {activeEvents.map((e) => {
                  const p = eventProgress(e.id, locations.data ?? [], items.data ?? [], ecs.data ?? []);
                  return (
                    <li key={e.id}>
                      <Link href={`/zawody/${e.id}`} className="block rounded-xl p-2 hover:bg-zinc-800/50">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="font-medium text-zinc-100">{e.name}</span>
                          <Badge tone={EVENT_STATUS[e.status].tone}>{EVENT_STATUS[e.status].label}</Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
                          <span>{formatDate(e.start_date)}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${p.ratio * 100}%` }} />
                          </div>
                          <span>{Math.round(p.ratio * 100)}%</span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold text-zinc-100">Kończy się</h2>
              <Link href="/zakupy" className="text-xs text-blue-400 hover:underline">
                lista zakupów
              </Link>
            </div>
            {low.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-zinc-500">
                <PackageSearch className="h-4 w-4" /> Wszystkie materiały powyżej minimum.
              </p>
            ) : (
              <ul className="space-y-2">
                {low.map((c) => (
                  <li key={c.id}>
                    <Link href={`/magazyn?tab=materialy&open=${c.id}`} className="flex items-center gap-3 text-sm hover:underline">
                      <span className="flex-1 truncate text-zinc-200">{c.name}</span>
                      <span className="tabular-nums text-red-300">
                        {c.quantity_stored}/{c.min_quantity} {c.unit}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="p-4">
          <h2 className="mb-4 font-semibold text-zinc-100">Ostatnie zmiany</h2>
          <ActivityList limit={15} showSubject />
        </Card>
      </div>
    </>
  );
}
