# Architektura

## Stack

| Warstwa | Technologia | Dlaczego |
|---|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind 3 | Strony to Client Components: kamera, realtime, optimistic UI |
| Dane w UI | TanStack Query 5 | Jeden cache dla wszystkich stron, deduplikacja, optimistic updates z rollbackiem |
| Backend | Supabase: Postgres 17, Auth, Realtime | Brak własnego serwera API, logika w SQL |
| Hosting | Vercel (frontend), Supabase eu-central-1 | |
| Testy | Vitest + PGlite (Postgres w WASM) | Migracje, RLS i RPC testowane bez Dockera, także w CI |

## Zasada naczelna: logika i bezpieczeństwo w bazie

Przeglądarka rozmawia z Postgresem bezpośrednio (PostgREST, klucz publishable). Dlatego:

1. **Autoryzacja = RLS.** `proxy.ts` tylko przekierowuje niezalogowanych na `/login`, ale niczego nie chroni.
   Każda tabela ma polityki oparte o `is_member()` / `is_admin()` (rola w `profiles`).
2. **Każda operacja wieloetapowa albo licznikowa to jedna funkcja SQL (RPC)**, wykonywana atomowo:
   `adjust_stock`, `pack_consumable`, `move_item_to_box`, `return_item`, `delete_box`, `close_event`, `receive_purchase`, `assign_label`…
   Klient wysyła **delty**, nie wartości absolutne, więc szybkie klikanie i kilka telefonów naraz się sumują.
3. **Spójność wymuszają constrainty i triggery**, a nie formularze: SKU, unikalność etykiet między tabelami, `quantity >= 0`, format linków.
4. **Audit log** (`activity_log`) wypełniają triggery na każdej tabeli. RPC ustawiają `app.action`, żeby wpis miał czytelny kontekst („spakowano”, „zwrot z wyjazdu”).

## Przepływ danych w UI

```
komponent ──useItems()──► TanStack Query cache ◄──invalidate── RealtimeSync (1 kanał postgres_changes)
    │                                ▲
    └──useAction()/rpc()──► Supabase RPC ─► Postgres (RLS, triggery, audit)
```

- `lib/data/queries.ts`: hooki odczytu. Cała tabela trafia do cache raz i jest współdzielona przez strony (skala koła: setki rekordów).
- `lib/data/mutations.ts`: `rpc()`, `useAction()` (toast błędu/sukcesu + inwalidacja), generyczne `useInsert/useUpdate/useDelete`,
  optimistic `useAdjustStock` / `usePackConsumable` (refetch dopiero po ostatnim kliknięciu w serii).
- `lib/data/realtime.tsx`: zmiana w bazie tylko oznacza zapytania jako nieaktualne (debounce 250 ms) i nie nadpisuje trwających mutacji.
- Odświeżanie po powrocie do karty/aplikacji: `refetchOnWindowFocus`, bo telefony usypiają websockety.

## Auth

- Logowanie: Google OAuth, email + hasło albo magic link (Supabase Auth). Sesja w cookies (`@supabase/ssr`), odświeżana w `proxy.ts`.
- Rejestracja tworzy `profiles` z rolą `guest` (trigger `handle_new_user`). **Pierwsze konto w systemie dostaje `admin`.**
- `guest → member`: jednorazowe wpisanie kodu koła (`join_club()`). Admin widzi kod w Ustawieniach i może wysłać link `/dolacz?kod=XXXXXX`.
- Role zmienia tylko admin (trigger `guard_profile_update`). Nie da się odebrać admina samemu sobie.

## Struktura katalogów

```
app/                  strony (App Router)
  login, dolacz,      logowanie, kod koła
  auth/callback       wymiana kodu OAuth/magic link na sesję
  magazyn, zakupy,    główne moduły
  zawody/[id], skan,
  ustawienia
components/
  ui/                 Button, Field, Modal (+ useBackToClose), Confirm, Badge, Tabs, Stepper…
  scanner/            ScannerModal + useBarcodeCamera
  inventory/          formularz, szczegóły, pole etykiety, historia, picker
  events/             skrzynia, rozliczenie, formularz wyjazdu
lib/
  supabase/           klient przeglądarki i serwera
  data/               queries, mutations, realtime, lookups, klucze cache
  database.types.ts   typy schematu (regenerować po migracji)
supabase/
  migrations/         jedyne źródło prawdy o schemacie
  tests/              testy migracji/RLS/RPC na PGlite
proxy.ts              odświeżanie sesji + redirect na /login
```

## Wzorce UI, których się trzymamy

- **Modale** (`components/ui/modal.tsx`): Escape, gest „wstecz” zamyka modal zamiast opuszczać stronę, blokada scrolla, stackowanie.
  Operacje na historii są serializowane (`pendingBack`), więc zamknięcie jednego modala i otwarcie drugiego nie gubi wpisów.
- **Stan modali jest lokalny, nie w URL.** Deep linki (`?open=`, `?item=`, `?label=` ze skanera) są przejmowane raz w renderze
  i czyszczone natywnym `history.replaceState`.
- **Potwierdzenia**: `useConfirm()` zamiast `window.confirm()`. **Błędy**: `toast` z `errorMessage()` (mapuje błędy PG na polski).
- **Formularze** resetują się tylko przy otwarciu albo zmianie rekordu, nigdy przy refetchu w tle.
