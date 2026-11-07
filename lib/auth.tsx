'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase/client';
import { qk } from '@/lib/data/keys';
import type { Profile } from '@/lib/types';

type AuthState = {
  user: User | null;
  /** true until the first session check finished */
  loading: boolean;
  profile: Profile | null;
  isMember: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (event === 'SIGNED_OUT') qc.clear();
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  const profileQuery = useQuery({
    queryKey: [...qk.me, user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const { data, error } = await getSupabase().from('profiles').select('*').eq('id', user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const value = useMemo<AuthState>(() => {
    const profile = profileQuery.data ?? null;
    return {
      user,
      loading: loading || (Boolean(user) && profileQuery.isPending),
      profile,
      isMember: profile?.role === 'member' || profile?.role === 'admin',
      isAdmin: profile?.role === 'admin',
      signOut: async () => {
        await getSupabase().auth.signOut();
        qc.clear();
        router.replace('/login');
        router.refresh();
      },
    };
  }, [user, loading, profileQuery.data, profileQuery.isPending, qc, router]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
