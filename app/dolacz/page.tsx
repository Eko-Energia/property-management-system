'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound, LogOut } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { rpc } from '@/lib/data/mutations';
import { qk } from '@/lib/data/keys';
import { errorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';

function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const { profile, isMember, loading, signOut } = useAuth();
  const [code, setCode] = useState(params.get('kod') ?? '');
  const [busy, setBusy] = useState(false);
  const next = params.get('next')?.startsWith('/') ? params.get('next')! : '/';

  useEffect(() => {
    if (!loading && isMember) router.replace(next);
  }, [loading, isMember, next, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await rpc('join_club', { p_code: code });
      await qc.invalidateQueries({ queryKey: qk.me });
      toast.success('Witamy w kole!');
      router.replace(next);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-zinc-400">
        Cześć{profile ? `, ${profile.display_name}` : ''}! Wpisz kod koła, który dostaniesz od zarządu (jednorazowo, na tym koncie).
      </p>
      <Input
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="KOD KOŁA"
        autoCapitalize="characters"
        autoComplete="off"
        className="h-12 text-center font-mono text-lg tracking-[0.3em]"
      />
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={code.trim().length < 4}>
        Dołącz
      </Button>
      <button type="button" onClick={signOut} className="flex w-full items-center justify-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300">
        <LogOut className="h-3.5 w-3.5" /> Wyloguj
      </button>
    </form>
  );
}

export default function JoinPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="rounded-xl bg-amber-500/10 p-2.5 text-amber-400">
            <KeyRound className="h-5 w-5" />
          </span>
          <h1 className="text-lg font-semibold text-zinc-50">Dołącz do koła</h1>
        </div>
        <Suspense>
          <JoinForm />
        </Suspense>
      </div>
    </div>
  );
}
