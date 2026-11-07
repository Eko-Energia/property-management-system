'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabase } from '@/lib/supabase/client';
import { TABLE_KEYS } from '@/lib/data/keys';

/**
 * One realtime channel for the whole app. A DB change only marks the
 * affected queries stale (debounced), React Query refetches what's on screen.
 * Replaces the old per-page "refetch every table on every event" pattern.
 */
export function RealtimeSync({ enabled }: { enabled: boolean }) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const supabase = getSupabase();
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const flush = () => {
      // don't fight optimistic updates that are still in flight
      if (qc.isMutating() > 0) {
        timer = setTimeout(flush, 400);
        return;
      }
      for (const table of pending) {
        for (const key of TABLE_KEYS[table] ?? []) qc.invalidateQueries({ queryKey: key });
      }
      pending.clear();
      timer = undefined;
    };

    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        pending.add(payload.table);
        if (!timer) timer = setTimeout(flush, 250);
      })
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [enabled, qc]);

  return null;
}
