# Przekazanie projektu

Dla osoby, która przejmuje magazyn koła: jak zacząć pracę z kodem, gdzie co stoi i jak przenieść konta (GitHub, Vercel, Supabase, Google Cloud) na nowych właścicieli.

Szczegóły techniczne są w osobnych plikach, tu tylko to, czego nie widać z kodu:
[ARCHITECTURE.md](ARCHITECTURE.md) (struktura aplikacji), [DATABASE.md](DATABASE.md) (schemat, RPC, RLS), [OPERATIONS.md](OPERATIONS.md) (konfiguracja paneli), [PITFALLS.md](PITFALLS.md) (pułapki).

> Ścieżki w panelach (Settings → …) są aktualne na listopad 2026. Dostawcy przestawiają menu, więc gdy czegoś nie ma w opisanym miejscu, szukaj po nazwie opcji.

---

## 1. Mapa usług

| Usługa | Co tam jest | Identyfikator | Plan |
|---|---|---|---|
| **GitHub** | Kod, CI (GitHub Actions) | `Eko-Energia/property-management-system` | Free (organizacja) |
| **Vercel** | Hosting Next.js, preview dla PR | team `eko-energia`, projekt `property-management-system`, domena `ekoenergia-pms.vercel.app` | Hobby/Free |
| **Supabase** | Postgres, Auth, Realtime | projekt `PMS`, ref `sxqznglujxvqldbfddah` (`https://sxqznglujxvqldbfddah.supabase.co`) | Free |
| **Google Cloud** | Klient OAuth dla „Kontynuuj z Google” | projekt GCP właściciela (nazwa: uzupełnij) | Free |

### Gdzie są sekrety

| Sekret | Gdzie leży | Kto go używa |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel → Project → Settings → Environment Variables; lokalnie `.env.local` | Front. Klucz jest **publiczny z założenia**, dostęp chroni RLS |
| Supabase `service_role` / secret key | tylko panel Supabase (Settings → API Keys) | **Nigdzie w aplikacji.** Nie wklejaj go do Vercela ani do repo |
| Hasło do bazy (connection string) | panel Supabase (Connect) | tylko do `pg_dump` / ręcznej pracy |
| Google OAuth Client ID + Secret | GCP → APIs & Services → Credentials; kopia w Supabase → Authentication → Providers → Google | Supabase Auth |

Nie ma innych sekretów: aplikacja nie wysyła maili, nie ma webhooków ani zewnętrznych API.

---

## 2. Start dla dewelopera

Wymagania: Node 22 (CI) lub ≥ 20.9, npm, git.

```bash
git clone https://github.com/Eko-Energia/property-management-system.git
cd property-management-system
npm ci
cp .env.example .env.local   # wpisz URL i publishable key z Supabase → Settings → API Keys
npm run dev                  # http://localhost:3000
```

Lokalny front łączy się z **produkcyjną bazą** (nie ma osobnego środowiska testowego). Uważaj na dane: twórz testowe rzeczy z prefiksem „TEST” i je usuwaj.

| Komenda | Co robi |
|---|---|
| `npm run check` | typecheck + lint + testy, to samo co CI |
| `npm test` | Vitest: testy SQL na PGlite (Postgres w WASM, bez Dockera) + testy jednostkowe |
| `npm run build` | build produkcyjny |

### Jak wchodzą zmiany

1. Branch od `master` → PR → CI (GitHub Actions) + preview na Vercelu.
2. Merge do `master` = automatyczny deploy na produkcję.
3. Zmiany w bazie: patrz niżej. **Najpierw baza, potem merge frontu.** Nowy front na starej bazie się wywali.

### Migracje bazy: jak to faktycznie działa

- Pliki w `supabase/migrations/`, nazwa `YYYYMMDDHHMMSS_opis.sql`, kolejność = kolejność nazw.
- Każda migracja ma testy w `supabase/tests/*.test.ts`. `createDb()` stawia stub Supabase, potem **schemat prototypu** (`prototype_schema.sql`), potem wszystkie migracje po kolei.
- Na produkcję migracje były do tej pory **wklejane ręcznie w Supabase → SQL Editor**, w kolejności.
- ⚠️ Przez to tabela `supabase_migrations.schema_migrations` jest pusta. **Nie odpalaj `supabase db push`** bez wcześniejszego oznaczenia istniejących migracji jako wykonanych (`supabase migration repair --status applied <wersja>` dla każdej), bo CLI spróbuje wykonać wszystko od nowa i padnie na pierwszej.
- `lib/database.types.ts` jest pisany ręcznie w formacie `supabase gen types`. Po zmianie schematu dopisz typy albo wygeneruj je (`npx supabase gen types typescript --project-id sxqznglujxvqldbfddah`, wymaga `supabase login`) i porównaj z istniejącym plikiem.
- Migracja `0001` przerabia ręcznie wyklikany prototyp. **Na pustej bazie się nie wykona.** Jak postawić bazę od zera: sekcja 5.

---

## 3. Przekazanie kont: zasada ogólna

Najprościej i najbezpieczniej: **dodać nową osobę jako współwłaściciela** w każdej usłudze, sprawdzić, że ma dostęp, a dopiero potem usunąć starego właściciela. Przenoszenie projektów między kontami robić tylko wtedy, gdy stare konto ma zniknąć całkiem.

Kolejność:
1. GitHub
2. Vercel
3. Supabase
4. Google Cloud
5. Sprawdzenie (sekcja 4.5)

Docelowo warto, żeby wszystko stało na **koncie koła** (np. wspólny Gmail zarządu), a nie na prywatnym koncie studenta, który za 2 lata kończy studia.

## 4. Krok po kroku

### 4.1 GitHub

Repo jest w organizacji `Eko-Energia`, więc przekazanie to przekazanie roli w organizacji:

1. Organizacja → **People** → Invite member → rola **Owner**.
2. Nowa osoba akceptuje zaproszenie.
3. Stary właściciel: zmiana swojej roli na Member albo wyjście z organizacji.

Przeniesienie repo do innej organizacji: repo → Settings → Danger Zone → Transfer. Potem w Vercelu trzeba ponownie podpiąć repo (Project → Settings → Git), bo integracja jest związana z właścicielem repo.

### 4.2 Vercel

1. Team `eko-energia` → **Settings → Members** → Invite → rola **Owner**.
   - Jeśli zapraszanie członków jest zablokowane planem (wieloosobowe teamy bywają funkcją płatną), przenieś projekt (pkt 2).
2. Przeniesienie projektu na inne konto lub team: Project → **Settings → General → Transfer Project**.
   - Zmienne środowiskowe i deploye przechodzą razem z projektem.
   - **Do sprawdzenia po transferze:** czy domena `ekoenergia-pms.vercel.app` została przy projekcie (Project → Settings → Domains). Jeśli nie, dodaj ją ponownie albo zmień adres w Supabase (pkt 4.3, URL Configuration).
3. Git: Project → Settings → **Git** musi wskazywać `Eko-Energia/property-management-system`, branch produkcyjny `master`.
   - Nowy właściciel Vercela potrzebuje dostępu do repo przez aplikację Vercel na GitHubie (organizacja → Settings → GitHub Apps → Vercel → dostęp do repo).
4. Env (Production + Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Po zmianie zrób Redeploy.

### 4.3 Supabase

1. Organizacja → **Team** → Invite → rola **Owner**. Nowa osoba ma wtedy pełny dostęp do projektu `PMS`.
2. Przeniesienie projektu do innej organizacji: Project → **Settings → General → Transfer project**.
   - Musisz być właścicielem obu organizacji.
   - Ref projektu, URL i klucze **nie zmieniają się**, więc w Vercelu nic nie trzeba ruszać.
   - Free tier ma limit aktywnych darmowych projektów na organizację; jeśli docelowa organizacja go wyczerpała, transfer się nie uda.
3. Konfiguracja Auth, którą trzeba zachować (przechodzi z projektem, ale sprawdź):
   - Authentication → Providers → Email: **Confirm email OFF**, **Secure password change OFF**.
   - Authentication → URL Configuration: Site URL i Redirect URLs z domeną aplikacji ([OPERATIONS.md](OPERATIONS.md)).
   - Authentication → Providers → Google: Client ID/Secret (pkt 4.4).
   - Authentication → Rate Limits → Email sent: nisko (aplikacja nie wysyła maili).
4. **Uśpienie:** darmowy projekt pauzuje się po 7 dniach bez ruchu.
   - Wybudzenie: panel Supabase → projekt → Restore. Dane zostają.
   - Po wybudzeniu aplikacja działa od razu.

### 4.4 Google Cloud (logowanie Google)

Klient OAuth to para Client ID + Secret w projekcie GCP; Supabase tylko je przechowuje. Są dwie drogi.

**A. Dodać nowego właściciela do istniejącego projektu GCP (zalecane)**
1. console.cloud.google.com → wybierz projekt → **IAM & Admin → IAM** → Grant access → rola **Owner** dla nowego konta.
2. Nowa osoba sprawdza **APIs & Services → OAuth consent screen** (w nowszym UI „Google Auth Platform”):
   - **Support email / Developer contact** zmień na nowe konto albo konto koła; inaczej Google wysyła powiadomienia do starego właściciela.
3. Stary właściciel usuwa się z IAM.

**B. Nowy klient OAuth w nowym projekcie GCP**
1. Nowy projekt GCP → **OAuth consent screen**:
   - typ **External**, nazwa „Magazyn Eko-Energia”, support email;
   - zakresy tylko `openid`, `email`, `profile` (nie wymagają weryfikacji Google).
2. **Ważne:** status publikacji ustaw na **In production**. W trybie „Testing” zalogować się mogą tylko ręcznie dopisani testerzy.
3. **Credentials → Create credentials → OAuth client ID**:
   - typ **Web application**;
   - Authorized redirect URI: `https://sxqznglujxvqldbfddah.supabase.co/auth/v1/callback`.
4. Skopiuj Client ID i Secret do Supabase → Authentication → Providers → **Google** i zapisz.
5. Przetestuj logowanie (pkt 4.5). Stary klient można usunąć dopiero po udanym teście.

Istniejące konta użytkowników **nie znikają** przy zmianie klienta OAuth: Supabase łączy je po adresie email.

### 4.5 Sprawdzenie po przekazaniu

- [ ] `https://ekoenergia-pms.vercel.app` się ładuje, logowanie Google działa (okno incognito).
- [ ] Logowanie emailem i hasłem działa.
- [ ] Ustawienia → Kod koła pokazuje kod i odliczanie.
- [ ] Test PR: otwórz PR z drobną zmianą. CI przechodzi, Vercel buduje preview.
- [ ] Nowy właściciel jest **adminem w aplikacji** (Ustawienia → Członkowie). Rolę nadaje dotychczasowy admin. Jeśli nie ma żadnego admina, użyj SQL Editora:
  ```sql
  -- trigger profiles_guard blokuje zmianę ról bez zalogowanego admina, także w SQL Editorze
  alter table public.profiles disable trigger profiles_guard;
  update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'nowy@admin.pl');
  alter table public.profiles enable trigger profiles_guard;
  ```
- [ ] Stare konta usunięte z GitHub / Vercel / Supabase / GCP.

---

## 5. Kopia zapasowa i stawianie bazy od zera

Darmowy plan Supabase **nie daje kopii zapasowych do pobrania**. Rób je sam, np. przed każdą migracją:

```bash
# connection string: Supabase → Connect → Session pooler (wymaga hasła do bazy)
pg_dump "postgresql://postgres.sxqznglujxvqldbfddah:<HASŁO>@<host>:5432/postgres" \
  --schema=public --schema=auth --no-owner --no-privileges -Fc -f pms-$(date +%F).dump
```

Nowy projekt Supabase (np. gdy stary przepadł):
1. Najprościej: odtwórz dump (`pg_restore --no-owner -d <nowa-baza> pms-….dump`). Schemat `auth` z dumpa zawiera konta użytkowników. Odtwarzanie go do świeżego projektu bywa kapryśne, więc w razie problemów odtwórz tylko `public`, a ludzie założą konta od nowa.
2. Bez dumpa, pusta baza:
   - wykonaj `supabase/tests/prototype_schema.sql` **bez** instrukcji `insert into` na końcu pliku (to dane testowe);
   - potem wszystkie pliki z `supabase/migrations/` po kolei.
   - Testy robią dokładnie to samo, więc ta ścieżka jest sprawdzona na PGlite, ale nie na prawdziwym Supabase.
3. W Vercelu podmień `NEXT_PUBLIC_SUPABASE_URL` i klucz, skonfiguruj Auth (pkt 4.3), w GCP dodaj nowy redirect URI `https://<nowy-ref>.supabase.co/auth/v1/callback`.
4. Pierwsze konto założone w aplikacji automatycznie dostaje rolę admina.

---

## 6. Decyzje, które warto znać przed zmianami

- **Brak maili, celowo.** Reset hasła działa kodem koła (rotuje co 15 min), bo darmowy SMTP Supabase wysyła ok. 2 maile na godzinę. Jeśli koło kiedyś będzie chciało maile: własny SMTP w Supabase ([OPERATIONS.md](OPERATIONS.md)).
- **Wygoda ponad bezpieczeństwo.** W aplikacji nie ma tajnych danych. Kod koła widzi każdy członek, a reset kodem nie działa tylko dla adminów.
- **Logika w bazie.** Operacje na stanach (pakowanie, zwroty, przyjęcie dostawy) to atomowe funkcje SQL (RPC), a nie kod w przeglądarce. Nowe operacje pisz tak samo i testuj w `supabase/tests`.
- **Etykiety są z rolki**, nie drukowane. Jeden kod = jedna rzecz, pilnuje tego trigger w bazie.
- Stara dokumentacja z okresu prototypu (Gemini) leży w `docs/archive/`. Jest nieaktualna i została tylko dla historii.
