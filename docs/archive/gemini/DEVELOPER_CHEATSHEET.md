# 🛠️ Ściąga Dewelopera (Developer Cheatsheet) — Eko-Energia PMS

Szybki podręcznik komend, konfiguracji środowiska, procedur testowych oraz standardów kodowania dla deweloperów i agentów AI.

---

## 1. Zmienne Środowiskowe (`.env.local`)

Utwórz plik `.env.local` w katalogu głównym projektu z następującą konfiguracją:

```ini
# Supabase URL i Anon Key
NEXT_PUBLIC_SUPABASE_URL=https://twoj-projekt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=twoj-anon-public-key

# Domena aplikacji używana do generowania linków w kodach QR
NEXT_PUBLIC_APP_URL=https://ekoenergia-pms.pl
```

> 💡 **Wskazówka:** Jeśli nie skonfigurujesz tych zmiennych, aplikacja automatycznie uruchomi się w **Trybie Demo (Mock Mode)** z pełnym zestawem przykładowych danych w pamięci.

---

## 2. Podstawowe Komendy

```bash
# Instalacja zależności
npm install

# Uruchomienie serwera deweloperskiego (http://localhost:3000)
npm run dev

# Zbudowanie zoptymalizowanej wersji produkcyjnej
npm run build

# Uruchomienie zbudowanej aplikacji produkcyjnej
npm run start

# Uruchomienie lintera ESLint
npm run lint
```

---

## 3. Checklist Przed Wdrożeniem / Zakończeniem Zmian (Definition of Done)

Każdy agent AI oraz deweloper przed zgłoszeniem zadania jako ukończone **musi przejść poniższą checklistę**:

- [ ] **1. Kompilacja produkcyjna**:  
  Uruchomiono `npm run build` i zakończył się on kodem wyjścia `0` (brak błędów TypeScriptu, brak błędów kompilatora SWC Next.js).
- [ ] **2. Brak Route Segment Configs w plikach klienckich**:  
  W żadnym pliku z nagłówkiem `'use client'` nie ma `export const dynamic` ani `export const revalidate`.
- [ ] **3. Nienaruszona biała lista skanera**:  
  W `ScannerButton.tsx` dozwolone formaty to **wyłącznie** `code_128` oraz `qr_code`.
- [ ] **4. Obsługa Trybu Demo (isDemoMode)**:  
  Jeśli dodano lub zmieniono funkcję zapisu/edycji/usuwania w bazie, posiada ona gałąź `if (isDemoMode)` aktualizującą stan lokalny i wyświetlającą Toast demo.
- [ ] **5. Responsywność mobilna**:  
  Wszystkie nowe modale posiadają `overflow-y-auto max-h-[75vh]` i poprawnie wyświetlają się na ekranach o szerokości 360–390px (np. iPhone SE / mały Android).
- [ ] **6. Ostrzeżenie przy usuwaniu**:  
  Nowo dodane przyciski usuwania rekordów zawierają okno dialogowe `if (!confirm(...)) return;`.
- [ ] **7. Generowanie SKU przy zmianie kategorii**:  
  Edycja kategorii istniejącego sprzętu/materiału automatycznie przelicza identyfikator na zgodny z nowym kodem kategorii.

---

## 4. Jak Dodać Nowe Pole do Istniejącej Tabeli w Bazie?

Jeśli potrzebujesz rozszerzyć model danych (np. dodać pole `serial_number` do sprzętu trwałego):

1. **Zaktualizuj typy w TypeScript** ([`utils/supabase/client.ts`](../utils/supabase/client.ts)):
   ```typescript
   export interface DatabaseItem {
     // ...
     serial_number?: string | null;
   }
   ```
2. **Dodaj kolumnę w bazie Supabase**:
   ```sql
   ALTER TABLE public.items ADD COLUMN serial_number TEXT;
   ```
3. **Zaktualizuj tablice mocków (Tryb Demo)**:
   W plikach [`app/magazyn/page.tsx`](../app/magazyn/page.tsx) oraz [`app/zawody/[id]/page.tsx`](../app/zawody/[id]/page.tsx) dopisz nowe pole do obiektów w `mockItems`.
4. **Zaktualizuj formularze i modale**:
   Dodaj odpowiednie pole formularza w [`app/components/ItemEditModal.tsx`](../app/components/ItemEditModal.tsx) z obsługą stanu `useState` oraz mapowaniem w `handleItemSubmit`.
5. **Uruchom build**:
   ```bash
   npm run build
   ```

---

## 5. Dobre Praktyki Kodu w Tym Projekcie

- **Kolorystyka Tailwind**: Stosujemy ciemny motyw oparty o paletę Zinc (`bg-zinc-950`, `bg-zinc-900`, `border-zinc-800`, `text-zinc-100`, akcenty `blue-500` i `blue-400`).
- **Mikrointerakcje i Haptyka**: Przy sukcesach używaj `navigator.vibrate(100)` (opakowane w `try/catch`) oraz krótkiego podświetlenia wiersza przez stan `recentlyUpdatedId`.
- **Ikony**: Używamy wyłącznie biblioteki `lucide-react`. Nowe ikony importuj bezpośrednio z tego pakietu.
- **Bezpieczeństwo kamery**: Pamiętaj, że dostęp do kamery na smartfonach wymaga protokołu HTTPS (`window.isSecureContext`). Komponent `ScannerButton` automatycznie wykrywa brak HTTPS i przełącza się w tryb wpisywania ręcznego z czytelnym ostrzeżeniem dla użytkownika.
