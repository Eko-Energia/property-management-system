# Baza danych

Źródło prawdy: `supabase/migrations/*.sql` (kolejność wg nazwy). Prototyp był klikany w dashboardzie; jego snapshot jest w
`supabase/tests/prototype_schema.sql` i to na nim testy odpalają migracje.

## Model

```
profiles (1:1 auth.users)      role: guest | member | admin
categories  code → prefiks SKU (BK = domyślna, nieusuwalna)
locations   kind: permanent (szafa/półka) | event_box (skrzynia, wymaga event_id)
events      status: planning → active → closed
items       sprzęt: id, sku, status, location_id, home_location_id, barcode, responsible_id
consumables materiały: id, sku, quantity_stored, min_quantity, unit, barcode
event_consumables  (box_id, consumable_id) unikalne: required / packed / returned
shopping_list      kind, status: pending → ordered → received | cancelled; consumable_id, is_auto
activity_log       audit: actor, table, row, action, context, old/new jsonb
app_settings       singleton: join_code
```

## Identyfikatory i etykiety

- **`id`** (bigint) jest stabilny i to po nim idą wszystkie relacje.
- **`sku`** (`I-EL-0001`, `C-BK-0003`) nadaje trigger `assign_sku` przez `next_sku()` pod advisory lockiem, więc nie ma kolizji.
  Zmiana kategorii nadaje nowe SKU. Jest to bezpieczne, bo SKU nie jest kluczem.
- **`barcode`** = fizyczna naklejka z rolki. Koło **nie drukuje nowych etykiet**: nowemu przedmiotowi przypisuje się istniejącą naklejkę.
  Każda wartość może być przypisana tylko raz, **łącznie w items i consumables** (unique + trigger `ensure_barcode_unique`).
  Przeniesienie naklejki: `assign_label(code, kind, id)` atomowo zdejmuje ją z poprzedniego rekordu.

## RPC (wszystkie `security invoker`, RLS działa)

| Funkcja | Co robi |
|---|---|
| `lookup_code(code)` | Szuka po etykiecie albo SKU (bez wstrzykiwania filtrów PostgREST) |
| `assign_label(code, kind, id)` | Przenosi etykietę |
| `adjust_stock(id, delta)` | Atomowe ± stanu, nigdy poniżej 0 |
| `move_item_to_box(item, box, status, force)` | Przypisanie/spakowanie, zapamiętuje `home_location_id`, blokuje sprzęt z innego wyjazdu |
| `unpack_item`, `return_item`, `mark_item` | Wyjęcie, zwrot do miejsca domowego, zaginiony/uszkodzony |
| `pack_consumable_into_box(box, c, qty, required)` | Dodaje pozycję (upsert) i pakuje |
| `pack_consumable(ec, delta)` | Przenosi sztuki magazyn ↔ skrzynia w jednej transakcji |
| `return_event_consumable(ec, returned)` | Zwrot na stan, reszta = zużyte |
| `delete_box(box)` / `delete_event(event)` | Usuwa bez utraty stanów: materiały wracają, sprzęt wraca do domu |
| `close_event(event, auto_return)` | Zamyka; bez `auto_return` odmawia, gdy coś nierozliczone |
| `receive_purchase(id, consumable, location, category)` | Przyjęcie dostawy: zwiększa stan albo tworzy rekordy, status `received` |
| `join_club(code)` | guest → member |
| `dashboard_stats()` | Liczniki na stronę główną w 1 zapytaniu |

## Automatyzacje (triggery)

- **Auto-zamówienia**: spadek poniżej `min_quantity` tworzy zgłoszenie (`is_auto`, ilość `2·min − stan`).
  Uzupełnienie stanu anuluje auto-zgłoszenie, o ile nie zostało jeszcze zamówione. Jedno otwarte zgłoszenie na materiał (unique partial index).
- `ordered_at` i `requested_by` uzupełniane automatycznie, `updated_at` na items/consumables.
- Audit wszystkich tabel magazynowych.

## Jak zmienić schemat

1. Nowy plik `supabase/migrations/<YYYYMMDDHHMMSS>_<opis>.sql`.
2. Test w `supabase/tests/migrations.test.ts`, potem `npm test` (PGlite, ~3 s).
3. Zastosowanie na Supabase: MCP `apply_migration` albo `npx supabase db push`.
4. Regeneracja `lib/database.types.ts` (MCP `generate_typescript_types` albo `npx supabase gen types typescript --project-id <ref>`).
