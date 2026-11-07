'use client';

import { useMemo } from 'react';
import { useCategories, useEvents, useLocations, useProfiles } from '@/lib/data/queries';
import type { Category, InventoryEvent, Location, Profile } from '@/lib/types';

/** id -> record maps for rendering names without N lookups per row. */
export function useLookups() {
  const categories = useCategories();
  const locations = useLocations();
  const events = useEvents();
  const profiles = useProfiles();

  return useMemo(() => {
    const byId = <T extends { id: number | string }>(rows: T[] | undefined) => new Map((rows ?? []).map((r) => [r.id, r] as const));
    const cat = byId<Category>(categories.data);
    const loc = byId<Location>(locations.data);
    const ev = byId<InventoryEvent>(events.data);
    const prof = byId<Profile>(profiles.data);
    const bk = categories.data?.find((c) => c.code === 'BK');

    const locationLabel = (id: number | null | undefined): string | null => {
      if (id == null) return null;
      const l = loc.get(id);
      if (!l) return null;
      if (l.kind === 'event_box') return `${l.name} · ${ev.get(l.event_id ?? -1)?.name ?? 'wyjazd'}`;
      return l.room ? `${l.name} (${l.room})` : l.name;
    };

    return {
      ready: Boolean(categories.data && locations.data && events.data && profiles.data),
      categories: categories.data ?? [],
      locations: locations.data ?? [],
      events: events.data ?? [],
      profiles: profiles.data ?? [],
      permanentLocations: (locations.data ?? []).filter((l) => l.kind === 'permanent'),
      defaultCategoryId: bk?.id ?? null,
      category: (id: number | null | undefined) => (id == null ? undefined : cat.get(id)),
      location: (id: number | null | undefined) => (id == null ? undefined : loc.get(id)),
      event: (id: number | null | undefined) => (id == null ? undefined : ev.get(id)),
      person: (id: string | null | undefined) => (id == null ? undefined : prof.get(id)),
      locationLabel,
    };
  }, [categories.data, locations.data, events.data, profiles.data]);
}

export type Lookups = ReturnType<typeof useLookups>;
