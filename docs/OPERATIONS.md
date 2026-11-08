# Uruchomienie, wdrożenie, utrzymanie

## Lokalnie

```bash
npm ci
cp .env.example .env.local   # uzupełnij URL i klucz z Supabase → Settings → API
npm run dev                  # http://localhost:3000
npm run check                # typecheck + lint + testy (w tym DB na PGlite)
```

Kamera działa tylko w secure context: `localhost` albo HTTPS. Na telefonie w LAN użyj `next dev --experimental-https`
albo testuj na preview z Vercela.

## Supabase: konfiguracja jednorazowa (dashboard)

| Gdzie | Ustawienie | Po co |
|---|---|---|
| Authentication → Providers → Email | **Confirm email: OFF** | Wbudowany SMTP Supabase wysyła kilka maili na godzinę, przy kilkudziesięciu osobach rejestracja by stanęła. Dostęp i tak chroni kod koła. Alternatywa: własny SMTP (np. Resend) i potwierdzanie ON |
| Authentication → URL Configuration | Site URL: `https://ekoenergia-pms.vercel.app`, Redirect URLs: `https://ekoenergia-pms.vercel.app/**`, `https://*-eko-energia.vercel.app/**`, `http://localhost:3000/**` | Powroty z Google i magic linka |
| Authentication → Providers → Google | Client ID/Secret z Google Cloud Console (OAuth client typu Web, redirect: `https://<ref>.supabase.co/auth/v1/callback`) | Logowanie jednym kliknięciem. Bez tego przycisk Google zwróci błąd, a email/hasło działa dalej |
| Project Settings | Free tier pauzuje projekt po 7 dniach bez ruchu | Patrz „Uśpienie projektu” niżej |
| Authentication → SMTP Settings | Własny SMTP (patrz niżej) | Reset hasła wysyła maila; wbudowany serwer Supabase puszcza ok. 2 maile/h na cały projekt |
| Authentication → Rate Limits → Email sent | np. 30–60/h | Po włączeniu własnego SMTP limit trzeba podnieść ręcznie |

### Maile (reset hasła) przez Gmail koła

Najprostsza darmowa opcja bez domeny: osobne konto Gmail koła (np. `ekoenergia.magazyn@gmail.com`).

1. Na tym koncie włącz weryfikację dwuetapową, potem utwórz **hasło aplikacji** (Konto Google → Bezpieczeństwo → Hasła do aplikacji).
2. Supabase → Authentication → SMTP Settings: host `smtp.gmail.com`, port `587`, user = pełny adres Gmail, hasło = 16-znakowe hasło aplikacji, sender = ten sam adres, nazwa „Magazyn Eko-Energia”.
3. Authentication → Rate Limits → Email sent: 30/h.
4. Opcjonalnie: Authentication → Email Templates → „Reset Password” przetłumacz na polski.

Limit Gmaila: 500 maili na dobę, przy kole kilkudziesięciu osób z dużym zapasem. Gdy koło kiedyś dostanie domenę: Resend albo Brevo (darmowe plany, lepsza dostarczalność, wymagają weryfikacji domeny/nadawcy).

## Vercel

- Env (Production + Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  (stary `NEXT_PUBLIC_SUPABASE_ANON_KEY` też działa, ale `env.ts` preferuje publishable).
- Brak zmiennych = błąd przy starcie, a nie cichy tryb demo.
- Deploy: push do `master` → produkcja; PR → preview.

## Pierwsze uruchomienie po migracji v2

1. Zastosuj migracje (`supabase/migrations`, w kolejności).
2. **Od razu załóż swoje konto.** Pierwsze konto dostaje rolę admin.
3. Ustawienia → Kod koła → „Kopiuj link zaproszenia” → wyślij na grupę koła.
4. Ustawienia → Miejsca w magazynie i Kategorie: uzupełnij słowniki.

## Uśpienie projektu (free tier)

Supabase Free wstrzymuje projekt po tygodniu bez zapytań. Przywrócenie: dashboard albo MCP `restore_project`, trwa kilka minut.
Jeśli to przeszkadza: plan Pro albo lekki cron (np. GitHub Actions co 3 dni wołający dowolny endpoint REST z kluczem publishable).

## Kopie zapasowe

Free tier nie ma PITR. `activity_log` trzyma pełne snapshoty starych wierszy, więc pojedyncze pomyłki da się odtworzyć ręcznie.
Pełny backup: `pg_dump` z connection stringa (Settings → Database), np. cron raz w tygodniu.
