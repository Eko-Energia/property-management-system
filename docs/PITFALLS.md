# Pułapki (zweryfikowane w praktyce)

## Skaner

- **Tylko Code 128 i QR** (`lib/scan.ts → SCAN_FORMATS`). ITF/EAN-8/Code 39/UPC-E dawały fałszywe, ucięte odczyty naklejek Code 128
  (np. `2137420000000` czytane jako `15977542`). Nie rozszerzać listy.
- **Kamerę zatrzymujemy ~300 ms po zamknięciu nakładki.** Synchroniczne `track.stop()` na iOS/Androidzie zmieniało viewport,
  wywoływało blur i zamykało formularz, do którego trafiał kod.
- **`onDetect` przez ref.** Wcześniej callback był w deps efektu, więc każdy re-render rodzica (realtime, toast) restartował kamerę.
- **Żadnych `min` w constraints wideo**, tylko `ideal`. `min: 1280×720` kończyło się OverconstrainedError na słabszych telefonach.
- **Każdy `await` sprawdza `cancelled`**: zamknięcie w trakcie startu nie może zostawić włączonej kamery.
- Kamera wymaga HTTPS albo localhost. Bez tego skaner sam przechodzi na wpisywanie ręczne.

## Next.js

- W plikach `'use client'` nie eksportuj `dynamic` / `revalidate` / `fetchCache` (SWC: `Invalid revalidate value "[object Object]"`).
- Next 16: middleware nazywa się `proxy.ts`, a `next lint` nie istnieje (używamy `eslint .`).
- `useSearchParams()` wymaga `<Suspense>`, inaczej build się wysypie.
- Do zmiany URL bez nawigacji używaj natywnego `window.history.replaceState`, które Next synchronizuje z routerem.
  `router.replace` przy otwartym modalu psuje obsługę gestu „wstecz”.

## Supabase / Postgres

- **Nigdy nie licz stanów w kliencie** (`old + delta` → `update`). Tylko RPC z deltą (`adjust_stock`, `pack_consumable`).
- Nie składaj filtrów PostgREST z danych użytkownika (`.or(\`barcode.eq.${code}\`)`), bo przecinek albo nawias w kodzie zmienia filtr.
  Szukanie po kodzie idzie przez `lookup_code()`.
- `apply_migration` / `execute_sql` przez MCP zwraca tylko wynik **ostatniego** zapytania.
- Wbudowany SMTP Supabase ma bardzo niski limit maili, patrz OPERATIONS.md.
- Free tier pauzuje projekt po 7 dniach bez ruchu: front wtedy pokazuje błąd połączenia (wcześniej po cichu przechodził w tryb demo).

## React 19 / lint

- Reguła `react-hooks/set-state-in-effect`: stan pochodny licz w renderze, a reset stanu przy otwarciu rób przez remount
  (`ScannerModal`) albo przez „adjust state during render” (formularze, deep linki).
