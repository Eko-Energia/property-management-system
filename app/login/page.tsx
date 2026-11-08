'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Boxes, KeyRound, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { getSupabase } from '@/lib/supabase/client';
import { errorMessage } from '@/lib/errors';
import { AdminsHint } from '@/components/admins-hint';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Tabs } from '@/components/ui/misc';

/** Only same-origin paths, never "//evil.com". */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

const AUTH_ERRORS: Record<string, string> = {
  'Invalid login credentials': 'Nieprawidłowy email lub hasło.',
  'User already registered': 'Konto z tym adresem już istnieje. Zaloguj się.',
  'Email not confirmed': 'Potwierdź adres email (link w skrzynce) i spróbuj ponownie.',
  'Password should be at least 6 characters.': 'Hasło musi mieć co najmniej 6 znaków.',
};

function LoginForm() {
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<null | 'password' | 'google' | 'reset'>(null);
  const [sent, setSent] = useState<string | null>(null);

  // Google redirects away; coming back with the browser's Back button restores this
  // page from the back/forward cache with the spinner still on -> reset it.
  useEffect(() => {
    const onShow = () => setBusy(null);
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  const callbackUrl = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  const fail = (err: unknown) => toast.error(AUTH_ERRORS[(err as Error)?.message] ?? errorMessage(err));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('password');
    const supabase = getSupabase();
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign(next);
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: callbackUrl() },
        });
        if (error) throw error;
        if (data.session) window.location.assign(next);
        else setSent(email);
      }
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  };

  const google = async () => {
    setBusy('google');
    const { error } = await getSupabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callbackUrl() } });
    if (error) {
      fail(error);
      setBusy(null);
    }
  };

  // No emails: the rotating club code proves you are in the club.
  const resetWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('reset');
    const supabase = getSupabase();
    try {
      const { error } = await supabase.rpc('reset_password_with_code', { p_email: email.trim(), p_code: code.trim(), p_password: password });
      if (error) throw error;
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (loginError) throw loginError;
      toast.success('Nowe hasło ustawione');
      window.location.assign(next);
    } catch (err) {
      fail(err);
      setBusy(null);
    }
  };

  if (sent) {
    return (
      <div className="space-y-3 text-center">
        <div className="mx-auto w-fit rounded-2xl bg-blue-500/10 p-3 text-blue-400">
          <Mail className="h-6 w-6" />
        </div>
        <p className="font-medium text-zinc-100">Sprawdź skrzynkę</p>
        <p className="text-sm text-zinc-400">
          Wysłaliśmy link na <span className="text-zinc-200">{sent}</span>. Kliknij go, żeby potwierdzić konto. Sprawdź też spam.
        </p>
        <Button variant="ghost" size="sm" onClick={() => setSent(null)}>
          Wróć
        </Button>
      </div>
    );
  }

  if (mode === 'reset') {
    return (
      <form onSubmit={resetWithCode} className="space-y-3">
        <button type="button" onClick={() => setMode('login')} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300">
          <ArrowLeft className="h-4 w-4" /> Logowanie
        </button>
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-blue-400" />
          <h2 className="font-semibold text-zinc-100">Nowe hasło kodem koła</h2>
        </div>
        <p className="text-sm text-zinc-400">
          Poproś dowolnego członka o aktualny kod koła (Ustawienia → Kod koła, zmienia się co 15 min). <AdminsHint />
        </p>
        <Field label="Email konta" required>
          {(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />}
        </Field>
        <Field label="Kod koła" required>
          {(id) => (
            <Input
              id={id}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
              minLength={4}
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="3FA9C1"
              className="text-center font-mono tracking-[0.3em]"
            />
          )}
        </Field>
        <Field label="Nowe hasło" required hint="Min. 6 znaków. Po zapisaniu od razu Cię zalogujemy.">
          {(id) => <Input id={id} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />}
        </Field>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy === 'reset'}>
          Ustaw hasło i zaloguj
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      <Button variant="light" size="lg" className="w-full" onClick={google} loading={busy === 'google'}>
        <GoogleIcon /> Kontynuuj z Google
      </Button>

      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <div className="h-px flex-1 bg-zinc-800" /> albo emailem <div className="h-px flex-1 bg-zinc-800" />
      </div>

      <Tabs
        className="grid w-full grid-cols-2"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'login', label: 'Logowanie' },
          { value: 'register', label: 'Nowe konto' },
        ]}
      />

      <form onSubmit={submit} className="space-y-3">
        {mode === 'register' && (
          <Field label="Imię i nazwisko (widoczne dla innych)" required>
            {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="name" placeholder="np. Kacper Nowak" />}
          </Field>
        )}
        <Field label="Email" required>
          {(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="ty@student.agh.edu.pl" />}
        </Field>
        <Field label="Hasło" required hint={mode === 'register' ? 'Min. 6 znaków. Zapamiętamy Cię na tym urządzeniu.' : undefined}>
          {(id) => (
            <Input
              id={id}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          )}
        </Field>
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy === 'password'}>
          {mode === 'login' ? 'Zaloguj się' : 'Utwórz konto'}
        </Button>
      </form>

      {mode === 'login' && (
        <button onClick={() => setMode('reset')} disabled={busy !== null} className="w-full text-center text-sm text-zinc-400 hover:text-zinc-200">
          Nie pamiętasz hasła? <span className="text-blue-400">Ustaw nowe kodem koła</span>
        </button>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
            <Boxes className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-50">Magazyn Eko-Energia</h1>
          <p className="mt-1 text-sm text-zinc-400">Sprzęt, materiały i pakowanie na wyjazdy</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}
