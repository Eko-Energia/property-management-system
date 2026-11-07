'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/lib/auth';
import { RealtimeSync } from '@/lib/data/realtime';
import { ConfirmProvider } from '@/components/ui/confirm';

function Realtime() {
  const { isMember } = useAuth();
  return <RealtimeSync enabled={isMember} />;
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true, // phones put websockets to sleep; refresh on return
            retry: (count, err) => count < 2 && !String((err as { code?: string })?.code ?? '').startsWith('42'),
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <ConfirmProvider>
          <Realtime />
          {children}
        </ConfirmProvider>
      </AuthProvider>
      <Toaster theme="dark" position="top-center" richColors closeButton duration={3500} />
    </QueryClientProvider>
  );
}
