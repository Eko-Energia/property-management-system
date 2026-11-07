'use client';

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/errors';
import { getSupabase } from '@/lib/supabase/client';
import { qk } from '@/lib/data/keys';
import type { Database } from '@/lib/database.types';
import type { Consumable, EventConsumable } from '@/lib/types';

type Fns = Database['public']['Functions'];
type Tables = Database['public']['Tables'];
type TableName = keyof Tables;

/** Calls a Postgres RPC and throws on error. */
export async function rpc<F extends keyof Fns>(fn: F, args: Fns[F]['Args']): Promise<Fns[F]['Returns']> {
  // supabase-js overloads don't narrow well on a generic F
  const { data, error } = await (getSupabase().rpc as (f: string, a: unknown) => PromiseLike<{ data: unknown; error: unknown }>)(fn, args);
  if (error) throw error;
  return data as Fns[F]['Returns'];
}

type ActionOptions<TVars, TResult> = {
  fn: (vars: TVars) => Promise<TResult>;
  /** Queries refreshed right after success (realtime also does it, this is just faster for the actor). */
  invalidate?: QueryKey[];
  success?: string | ((result: TResult, vars: TVars) => string | undefined);
  mutationKey?: QueryKey;
};

/** useMutation + error toast + optional success toast + cache invalidation. */
export function useAction<TVars = void, TResult = unknown>({ fn, invalidate = [], success, mutationKey }: ActionOptions<TVars, TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey,
    mutationFn: fn,
    onSuccess: (result, vars) => {
      const msg = typeof success === 'function' ? success(result, vars) : success;
      if (msg) toast.success(msg);
    },
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => Promise.all(invalidate.map((key) => qc.invalidateQueries({ queryKey: key }))),
  });
}

// ---------- generic table CRUD ----------
export function useInsert<T extends TableName>(table: T, opts: { invalidate?: QueryKey[]; success?: string } = {}) {
  return useAction<Tables[T]['Insert'], Tables[T]['Row']>({
    fn: async (values) => {
      const { data, error } = await getSupabase().from(table).insert(values as never).select().single();
      if (error) throw error;
      return data as unknown as Tables[T]["Row"];
    },
    invalidate: opts.invalidate,
    success: opts.success,
  });
}

export function useUpdate<T extends TableName>(table: T, opts: { invalidate?: QueryKey[]; success?: string } = {}) {
  return useAction<{ id: Tables[T]['Row'] extends { id: infer I } ? I : never; values: Tables[T]['Update'] }, Tables[T]['Row']>({
    fn: async ({ id, values }) => {
      const { data, error } = await getSupabase().from(table).update(values as never).eq('id' as never, id as never).select().single();
      if (error) throw error;
      return data as unknown as Tables[T]["Row"];
    },
    invalidate: opts.invalidate,
    success: opts.success,
  });
}

export function useDelete<T extends TableName>(table: T, opts: { invalidate?: QueryKey[]; success?: string } = {}) {
  return useAction<number | string, void>({
    fn: async (id) => {
      const { error } = await getSupabase().from(table).delete().eq('id' as never, id as never);
      if (error) throw error;
    },
    invalidate: opts.invalidate,
    success: opts.success,
  });
}

// ---------- optimistic counters (stock +/- and packing) ----------
const STOCK_KEY = ['stock-adjust'] as const;

/**
 * Warehouse +/-: applies the delta to the cache instantly and sends the delta
 * (not an absolute value) to the DB, so rapid taps and concurrent users add up.
 */
export function useAdjustStock() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: STOCK_KEY,
    mutationFn: ({ id, delta }: { id: number; delta: number }) => rpc('adjust_stock', { p_consumable_id: id, p_delta: delta }),
    onMutate: async ({ id, delta }) => {
      await qc.cancelQueries({ queryKey: qk.consumables });
      qc.setQueryData<Consumable[]>(qk.consumables, (old) =>
        old?.map((c) => (c.id === id ? { ...c, quantity_stored: Math.max(0, c.quantity_stored + delta) } : c)),
      );
    },
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => {
      // refetch only after the last in-flight tap, otherwise we'd flicker back
      if (qc.isMutating({ mutationKey: STOCK_KEY }) === 1) {
        qc.invalidateQueries({ queryKey: qk.consumables });
        qc.invalidateQueries({ queryKey: qk.shopping });
      }
    },
  });
}

const PACK_KEY = ['pack-consumable'] as const;

export function usePackConsumable() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: PACK_KEY,
    mutationFn: ({ ec, delta }: { ec: EventConsumable; delta: number }) => rpc('pack_consumable', { p_ec_id: ec.id, p_delta: delta }),
    onMutate: async ({ ec, delta }) => {
      await Promise.all([qc.cancelQueries({ queryKey: qk.eventConsumables }), qc.cancelQueries({ queryKey: qk.consumables })]);
      qc.setQueryData<EventConsumable[]>(qk.eventConsumables, (old) =>
        old?.map((r) => (r.id === ec.id ? { ...r, quantity_packed: Math.max(0, r.quantity_packed + delta) } : r)),
      );
      qc.setQueryData<Consumable[]>(qk.consumables, (old) =>
        old?.map((c) => (c.id === ec.consumable_id ? { ...c, quantity_stored: Math.max(0, c.quantity_stored - delta) } : c)),
      );
    },
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: () => {
      if (qc.isMutating({ mutationKey: PACK_KEY }) === 1) {
        qc.invalidateQueries({ queryKey: qk.eventConsumables });
        qc.invalidateQueries({ queryKey: qk.consumables });
      }
    },
  });
}

export const INVENTORY_KEYS: QueryKey[] = [qk.items, qk.consumables, qk.locations, qk.eventConsumables, qk.stats];
