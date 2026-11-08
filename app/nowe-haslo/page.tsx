'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { getSupabase } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

const ERRORS: Record<string, string> = {
  'New password should be different from the old password.': 'Nowe hasło musi być inne niż poprzednie.',
  'Password should be at least 6 characters.': 'Hasło musi mieć co najmniej 6 znaków.',
};

/** Reached from the "forgot password" email (session already set by /auth/callback) or from settings. */
export default function NewPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const mismatch = repeat.length > 0 && password !== repeat;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== repeat) return;
    setBusy(true);
    const { error } = await getSupabase().auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(ERRORS[error.message] ?? errorMessage(error));
      return;
    }
    toast.success('Hasło zmienione');
    router.replace('/');
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-blue-500/10 p-2.5 text-blue-400">
            <KeyRound className="h-5 w-5" />
          </span>
          <h1 className="text-lg font-semibold text-zinc-50">Ustaw nowe hasło</h1>
        </div>
        <Field label="Nowe hasło" required hint="Min. 6 znaków.">
          {(id) => <Input id={id} type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />}
        </Field>
        <Field label="Powtórz hasło" required error={mismatch ? 'Hasła się różnią' : null}>
          {(id) => <Input id={id} type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} required minLength={6} autoComplete="new-password" />}
        </Field>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={!password || mismatch}>
          Zapisz hasło
        </Button>
        <button type="button" onClick={() => router.replace('/')} className="w-full text-center text-sm text-zinc-500 hover:text-zinc-300">
          Anuluj
        </button>
      </form>
    </div>
  );
}
