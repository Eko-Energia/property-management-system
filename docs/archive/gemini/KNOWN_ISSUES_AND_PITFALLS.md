# ⚠️ Rozwiązane Problemy i Pułapki (Hall of Fame) — Eko-Energia PMS

> **DLA KAŻDEGO AGENTA AI**: Przeczytaj ten dokument z najwyższą uwagą. Zostały tu zebrane błędy, które spędziły sen z powiek zespołowi. **Nigdy nie "naprawiaj" ani nie refaktoryzuj kodu w sposób, który przywróci te problemy.**

---

## 1. Błąd Kompilatora SWC w Next.js przy Próbie Wyłączenia Cache
- **Objaw**: Podczas `npm run build` kompilacja kończy się błędem:
  ```text
  Error: Invalid revalidate value "[object Object]"
  lub
  unhandledRejection Error [PageNotFoundError]: Cannot find module for page: /_document
  ```
- **Przyczyna**: Wstawienie dyrektyw konfiguracyjnych tras (Route Segment Config):
  ```typescript
  export const dynamic = 'force-dynamic';
  export const revalidate = 0;
  export const fetchCache = 'force-no-store';
  ```
  bezpośrednio do plików oznaczonych `'use client'`. W plikach klienckich kompilator SWC Next.js zamienia wszystkie eksporty w moduł JavaScript z obiektami. Silnik budowania Next.js oczekuje wartości prymitywnej (liczby `0` lub stringa), a dostaje `[object Object]`.
- **Prawidłowe rozwiązanie**: W Client Components świeżość danych gwarantujemy po stronie przeglądarki:
  1. `useEffect(() => { fetchData(); }, [])`
  2. Nasłuchiwaniem zdarzeń `visibilitychange` oraz `focus` na `window`.
  3. Kanałami Supabase Realtime (`supabase.channel(...).on('postgres_changes', ...)`).

---

## 2. Zamykanie Modala przy Wyłączaniu Kamery na Smartfonie (Mobile Camera Lifecycle Bug)
- **Objaw**: Na telefonach (Safari iOS i Chrome Android) zeskanowanie kodu kreskowego powodowało otwarcie modala, który po 100 ms **samoczynnie znikał**.
- **Przyczyna**: Bezpośrednie wywołanie `mediaStream.getTracks().forEach(t => t.stop())` lub `html5QrCode.stop()` zamykało strumień wideo natychmiast. Przeglądarka mobilna w tym momencie przywracała domyślny rozmiar okna (pokazanie paska adresu `vh resize`), wywoływała event `blur` i resetowała stan drzewa Reacta w rodzicu.
- **Prawidłowe rozwiązanie**:
  1. W momencie sukcesu natychmiast wywołaj `html5QrCode.pause()` (zamraża obraz, ale nie niszczy jeszcze kamery).
  2. Przekaż kod do formularza (`onScan(cleanCode)`).
  3. Zamknij **tylko** nakładkę skanera (`setIsOpen(false)`).
  4. Pełne zwolnienie zasobów sprzętowych kamery (`stop()`, zerowanie tracków) wykonaj **asynchronicznie w tle** po minimum 300 ms (`setTimeout(..., 300)`).

---

## 3. Fałszywe Odczyty i Skrócone Ciągi (Partial Read / False Positives)
- **Objaw**: Fizyczna naklejka z kodem Code 128 o wartości `2137420000000` (13 cyfr) była na telefonach odczytywana jako losowy ciąg 8-cyfrowy (np. `15977542`).
- **Przyczyna**: Zezwolenie na dekodowanie formatów o niskiej sumie kontrolnej lub elastycznych długościach (`ITF`, `EAN-8`, `CODE-39`, `UPC-E`). Gdy celownik kamery obejmował tylko część kresek z naklejki Code 128, algorytm ITF interpretował ten wycinek jako poprawny kod.
- **Prawidłowe rozwiązanie**:
  - Zarówno w natywnym `BarcodeDetector`, jak i w `html5-qrcode`, biała lista dozwolonych formatów jest **bezwzględnie ograniczona** do:
    - `'code_128'`
    - `'qr_code'`
  - **ZAKAZ**: Nie dodawaj do listy `ean_8`, `itf`, `code_39`, `upc_e`, `ean_13`.

---

## 4. Gubienie Wartości Kodu w Formularzu na Telefonach (Stale State Callback)
- **Objaw**: Po zeskanowaniu naklejki w modalu dodawania/edycji przedmiotu pojawiał się komunikat sukcesu, ale pole tekstowe "Kod kreskowy" w formularzu pozostawało puste.
- **Przyczyna**: Opóźnienia w kolejce mikrozadań Reacta na mobilnym Safari oraz nieaktualne domknięcia stanów (*stale closures*).
- **Prawidłowe rozwiązanie**:
  W callbacku `onScan` komponentu `ScannerButton` stosujemy dwutorowe przypisanie:
  ```typescript
  // 1. Reaktywny stan Reacta
  setItemBarcode(cleanCode);

  // 2. Wymuszenie wartości bezpośrednio w drzewie DOM jako bezpiecznik
  setTimeout(() => {
    const input = document.getElementById('barcode-input') as HTMLInputElement;
    if (input) {
      input.value = cleanCode;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, 50);
  ```

---

## 5. Zmiana Kategorii Przedmiotu Musi Aktualizować SKU
- **Objaw**: Przedmiot utworzony jako "Bez kategorii" otrzymywał SKU `I-BK-0001`. Po późniejszej edycji i zmianie kategorii na "Elektronika" (`EL`) jego ID nadal pozostawało `I-BK-0001`, co psuło porządek w magazynie.
- **Prawidłowe rozwiązanie**:
  Funkcja `handleItemCategoryChange` w `ItemEditModal.tsx` oraz `handleConsCategoryChange` w `app/magazyn/page.tsx` weryfikują, czy nowa kategoria różni się od dotychczasowej. Jeśli tak, asynchronicznie wyliczają nowy kolejny identyfikator (`suggestNextSku`) i aktualizują pole `id` przedmiotu.

---

## 6. Duplikat Filtra "Bez kategorii" vs "Brak kategorii"
- **Objaw**: Na liście rozwijanej filtrów w magazynie widniały jednocześnie dwie pozycje: "Bez kategorii" oraz "Brak kategorii".
- **Prawidłowe rozwiązanie**:
  Pozostawiono wyłącznie pozycję **"Bez kategorii"**. Logika filtrowania została zaktualizowana tak, aby wybór "Bez kategorii" dopasowywał zarówno rekordy mające `category_id` wskazujące na kategorię `BK`, jak i rekordy mające `category_id = null`.
  Dodatkowo, etykieta kategorii nie jest renderowana na liście przedmiotów, jeśli kategoria to `BK`.

---

## 7. Brak Możliwości Przewijania Modali na Małych Smartfonach
- **Objaw**: Na mniejszych telefonach (np. iPhone SE) dolna część formularza edycji materiałów zużywalnych (w tym przyciski "Zapisz" i "Usuń") znajdowała się poza ekranem i nie dało się do niej przewinąć.
- **Prawidłowe rozwiązanie**:
  Każdy kontener formularza wewnątrz modala posiada klasy:
  `flex-1 overflow-y-auto max-h-[75vh]` (lub `max-h-[85vh]`). Dzięki temu modal zachowuje stałą pozycję, a jego wnętrze płynnie się przewija.

---

## 8. Wyścig Stanów przy Szybkim Klikaniu `+` / `-` w Magazynie
- **Objaw**: Szybkie 5-krotne kliknięcie przycisku `+` zwiększało stan materiału tylko o 1 lub 2 sztuki.
- **Przyczyna**: Asynchroniczność wywołań `setConsumables(prev => ...)` w połączeniu z oczekiwaniem na odpowiedź z Supabase powodowała, że kolejne kliknięcie czytało stary stan z poprzedniej klatki.
- **Prawidłowe rozwiązanie**:
  Wprowadzono referencję `consumablesRef = useRef<DatabaseConsumable[]>([])`. Wszelkie kalkulacje delty (`delta > 0`) są natychmiast aplikowane do referencji, która synchronizuje się synchronicznie, a stan Reacta oraz zapytanie do bazy są wyzwalane równolegle.

---

## 9. Przypadkowe Usuwanie Zasobów
- **Zasada**: Jakakolwiek operacja usunięcia przedmiotu trwałego (`items`), materiału (`consumables`), skrzyni wyjazdowej (`locations`) lub zapotrzebowania (`event_consumables`) **MUSI** być poprzedzona oknem potwierdzenia:
  ```typescript
  if (!confirm('Czy na pewno chcesz usunąć ten przedmiot z inwentarza?')) {
    return;
  }
  ```
