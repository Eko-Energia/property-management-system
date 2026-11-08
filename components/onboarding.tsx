'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Boxes, KeyRound, Plane, ScanLine, Settings, Shield, ShoppingCart, User, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { qk } from '@/lib/data/keys';
import { getSupabase } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';

type Step = { icon: typeof Boxes; title: string; body: ReactNode };
type Tour = { key: 'welcome' | 'admin'; steps: Step[]; finishLabel: string; finishHref?: string };

const WELCOME: Tour = {
  key: 'welcome',
  finishLabel: 'Zaczynamy',
  steps: [
    {
      icon: Boxes,
      title: 'Witaj w magazynie koła',
      body: (
        <>
          <p>
            <b>Sprzęt</b> to rzeczy trwałe (lutownica, laptop, koło zapasowe). Każda sztuka ma swoją naklejkę z kodem z rolki.
          </p>
          <p>
            <b>Materiały</b> to rzeczy zużywalne (śrubki, opaski, taśma). Liczy się stan, zmieniasz go przyciskami − / +.
          </p>
        </>
      ),
    },
    {
      icon: ScanLine,
      title: 'Skaner zamiast szukania',
      body: (
        <>
          <p>Okrągły przycisk na środku dolnego paska (na komputerze: w nagłówku) włącza aparat.</p>
          <p>
            Zeskanuj naklejkę, a od razu zobaczysz, co to jest i gdzie leży. Gdy zeskanujesz <b>nową naklejkę z rolki</b>, aplikacja zaproponuje, żeby przypisać ją do nowej
            albo istniejącej rzeczy.
          </p>
        </>
      ),
    },
    {
      icon: Plane,
      title: 'Wyjazdy i skrzynie',
      body: (
        <>
          <p>Przed wyjazdem utwórz go w zakładce Wyjazdy i dodaj skrzynie (każda ma opiekuna i miejsce, gdzie stoi).</p>
          <p>Pakujesz, skanując rzeczy do wybranej skrzyni. Po powrocie w „Powrót i rozliczenie” odhaczasz, co wróciło, a co zginęło.</p>
        </>
      ),
    },
    {
      icon: ShoppingCart,
      title: 'Zakupy same się zapisują',
      body: (
        <>
          <p>Gdy materiału spadnie poniżej minimum, sam trafia na listę zakupów. Możesz też dopisać coś ręcznie.</p>
          <p>Po dostawie kliknij „Przyjmij”, a stan w magazynie zwiększy się sam.</p>
        </>
      ),
    },
    {
      icon: User,
      title: 'Twoje rzeczy',
      body: (
        <>
          <p>
            Filtr <b>„Pod moją opieką”</b> w Magazynie pokazuje to, za co odpowiadasz.
          </p>
          <p>W Ustawieniach zmienisz imię i hasło, a ten samouczek otworzysz jeszcze raz.</p>
        </>
      ),
    },
  ],
};

const ADMIN: Tour = {
  key: 'admin',
  finishLabel: 'Pokaż ustawienia',
  finishHref: '/ustawienia',
  steps: [
    {
      icon: Shield,
      title: 'Masz teraz uprawnienia admina',
      body: (
        <>
          <p>W Ustawieniach pojawiły się nowe rzeczy, dostępne tylko dla zarządu:</p>
          <ul className="space-y-2">
            <li className="flex gap-2">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              <span>
                <b>Kod koła</b>: link zaproszenia dla nowych osób; gdy wycieknie, wygenerujesz nowy.
              </span>
            </li>
            <li className="flex gap-2">
              <Users className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
              <span>
                <b>Członkowie</b>: zmiana roli jednym kliknięciem, odbieranie dostępu i usuwanie kont.
              </span>
            </li>
            <li className="flex gap-2">
              <Settings className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
              <span>Możesz też usuwać wyjazdy i kategorie.</span>
            </li>
          </ul>
        </>
      ),
    },
  ],
};

export const TOUR_EVENT = 'pms:show-tour';

/** First-run tutorial for members and a short one when someone becomes admin. Seen tours are stored on the profile. */
export function Onboarding() {
  const { profile, isMember, isAdmin } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState<string | null>(null);

  // "Pokaż samouczek" in settings clears seen_tips and fires this event
  useEffect(() => {
    const reopen = () => {
      setDismissed(null);
      setStep(0);
    };
    window.addEventListener(TOUR_EVENT, reopen);
    return () => window.removeEventListener(TOUR_EVENT, reopen);
  }, []);

  const seen = profile?.seen_tips ?? [];
  const tour: Tour | null = !profile || !isMember ? null : !seen.includes('welcome') ? WELCOME : isAdmin && !seen.includes('admin') ? ADMIN : null;
  const open = Boolean(tour) && dismissed !== tour?.key;

  const finish = (goTo?: string) => {
    if (!tour || !profile) return;
    const next = [...new Set([...seen, tour.key])];
    setDismissed(tour.key);
    setStep(0);
    // optimistic: the next tour (if any) can show right away
    qc.setQueryData<Profile | null>([...qk.me, profile.id], (old) => (old ? { ...old, seen_tips: next } : old));
    void getSupabase()
      .from('profiles')
      .update({ seen_tips: next })
      .eq('id', profile.id)
      .then(() => qc.invalidateQueries({ queryKey: qk.me }));
    if (goTo) router.push(goTo);
  };

  if (!tour) return null;
  const current = tour.steps[Math.min(step, tour.steps.length - 1)];
  const last = step >= tour.steps.length - 1;
  const Icon = current.icon;

  return (
    <Modal
      open={open}
      onClose={() => finish()}
      size="sm"
      title={tour.key === 'admin' ? 'Nowe uprawnienia' : `Jak to działa (${step + 1}/${tour.steps.length})`}
      footer={
        <>
          {!last && (
            <button onClick={() => finish()} className="mr-auto text-sm text-zinc-500 hover:text-zinc-300">
              Pomiń
            </button>
          )}
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              Wstecz
            </Button>
          )}
          {last && tour.finishHref && (
            <Button variant="ghost" onClick={() => finish()}>
              Później
            </Button>
          )}
          <Button variant="primary" onClick={() => (last ? finish(tour.finishHref) : setStep((s) => s + 1))}>
            {last ? tour.finishLabel : 'Dalej'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-blue-500/10 p-3 text-blue-400">
            <Icon className="h-6 w-6" />
          </span>
          <h3 className="text-lg font-semibold text-zinc-50">{current.title}</h3>
        </div>
        <div className="space-y-2 text-sm leading-relaxed text-zinc-300 [&_b]:text-zinc-100">{current.body}</div>
        {tour.steps.length > 1 && (
          <div className="flex justify-center gap-1.5 pt-1">
            {tour.steps.map((_, i) => (
              <button key={i} onClick={() => setStep(i)} aria-label={`Krok ${i + 1}`} className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-6 bg-blue-500' : 'w-1.5 bg-zinc-700')} />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
