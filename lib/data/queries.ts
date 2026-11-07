'use client';

import { useQuery } from '@tanstack/react-query';
import { getSupabase } from '@/lib/supabase/client';
import { qk } from '@/lib/data/keys';
import type { ActivityEntry, DashboardStats } from '@/lib/types';

const sb = () => getSupabase();

/** Unwraps a Supabase response, throwing its error so React Query can surface it. */
async function unwrap<T>(promise: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw error;
  return data as T;
}

// Club scale (hundreds of rows): whole tables, cached once and shared by every page.
export const useItems = () =>
  useQuery({ queryKey: qk.items, queryFn: () => unwrap(sb().from('items').select('*').order('sku')) });

export const useConsumables = () =>
  useQuery({ queryKey: qk.consumables, queryFn: () => unwrap(sb().from('consumables').select('*').order('name')) });

export const useLocations = () =>
  useQuery({ queryKey: qk.locations, queryFn: () => unwrap(sb().from('locations').select('*').order('name')) });

export const useCategories = () =>
  useQuery({ queryKey: qk.categories, queryFn: () => unwrap(sb().from('categories').select('*').order('name')) });

export const useEvents = () =>
  useQuery({
    queryKey: qk.events,
    queryFn: () => unwrap(sb().from('events').select('*').order('start_date', { ascending: false })),
  });

export const useEventConsumables = () =>
  useQuery({ queryKey: qk.eventConsumables, queryFn: () => unwrap(sb().from('event_consumables').select('*').order('id')) });

export const useShoppingList = () =>
  useQuery({
    queryKey: qk.shopping,
    queryFn: () => unwrap(sb().from('shopping_list').select('*').order('created_at', { ascending: false })),
  });

export const useProfiles = () =>
  useQuery({ queryKey: qk.profiles, queryFn: () => unwrap(sb().from('profiles').select('*').order('display_name')) });

export const useStats = (enabled = true) =>
  useQuery({
    queryKey: qk.stats,
    enabled,
    queryFn: async () => (await unwrap(sb().rpc('dashboard_stats'))) as unknown as DashboardStats,
  });

export const useJoinCode = (enabled: boolean) =>
  useQuery({
    queryKey: qk.settings,
    enabled,
    queryFn: async () => {
      const { data, error } = await sb().from('app_settings').select('join_code').single();
      if (error) throw error;
      return data;
    },
  });

/** Activity feed; pass a row to get one record's history. */
export function useActivity(filter?: { table: string; rowId: number | string }, limit = 30) {
  return useQuery({
    queryKey: [...qk.activity, filter?.table ?? 'all', String(filter?.rowId ?? ''), limit],
    queryFn: () => {
      let q = sb().from('activity_log').select('*').order('at', { ascending: false }).limit(limit);
      if (filter) q = q.eq('table_name', filter.table).eq('row_id', String(filter.rowId));
      return unwrap(q) as Promise<ActivityEntry[]>;
    },
  });
}
