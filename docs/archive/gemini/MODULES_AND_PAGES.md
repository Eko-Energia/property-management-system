# 📦 Moduły i Komponenty Aplikacji — Eko-Energia PMS

Dokument ten zawiera szczegółowy opis każdej podstrony oraz kluczowych komponentów wielokrotnego użytku w projekcie.

---

## 1. Przegląd Podstron (App Router)

### A. Panel Główny / Dashboard ([`app/page.tsx`](../app/page.tsx))
- **Główny cel**: Widok podsumowujący kondycję koła naukowego oraz szybkie skróty.
- **Kluczowe elementy**:
  - Wskaźnik stanu bazy: zielona kropka *"Połączono z bazą"* lub żółta *"Tryb demonstracyjny"*.
  - Karty analityczne: Liczba sprzętów trwałych, materiałów zużywalnych, alertów braków magazynowych, aktywnych zawodów oraz lokalizacji.
  - Szybkie kafelki nawigacyjne do modułów: Magazyn, Wyjazdy, Zakupy, Skaner.
  - Automatyczne odświeżanie statystyk przez `visibilitychange` oraz `supabase.channel`.

---

### B. Główny Magazyn ([`app/magazyn/page.tsx`](../app/magazyn/page.tsx))
- **Główny cel**: Zarządzanie całym majątkiem koła w bazie stacjonarnej.
- **Dwie zakładki główne**:
  1. **Sprzęt Trwały (Items)**:
     - Tabela (desktop) oraz karty (mobile).
     - Kolumny: ID (SKU), Nazwa, Kod kreskowy (etykieta Barcode), Lokalizacja (szafa/półka), Opiekun, Status (`W warsztacie`, `Przypisany na wyjazd`, `Spakowany do skrzyni`), Akcje.
     - Przycisk usuwania (ikona kosza) z oknem potwierdzenia `confirm(...)`.
  2. **Materiały Zużywalne (Consumables)**:
     - Wyświetlanie stanu magazynowego z ostrzeżeniem, gdy `quantity_stored < min_quantity`.
     - Szybkie przyciski `+` oraz `-` pozwalające jednym dotknięciem na telefonie zmienić ilość w magazynie (optymistyczna synchronizacja z bazą).
     - Przycisk usuwania materiału z potwierdzeniem.
- **Narzędzia i Filtry**:
  - Pole wyszukiwania tekstowego (szuka po nazwie, SKU, kodzie kreskowym, opiekunie).
  - Filtr lokalizacji (w tym podział na szafy stałe i skrzynie wyjazdowe).
  - Filtr kategorii (specjalna logika dla "Bez kategorii" `BK`).
  - Sortowanie wielopoziomowe (po ID, nazwie, ilości, opiekunie).
- **Modale administracyjne**:
  - Zarządzanie lokalizacjami (dodawanie/edycja półek i skrzyń).
  - Zarządzanie kategoriami (dodawanie nowych kategorii z kodami).
  - Modal edycji przedmiotu (`ItemEditModal`).
  - Modal edycji materiału (w pełni przewijalny na urządzeniach mobilnych).

---

### C. Zapotrzebowanie i Zakupy ([`app/magazyn/zakupy/page.tsx`](../app/magazyn/zakupy/page.tsx))
- **Główny cel**: Automatyzacja zaopatrzenia koła.
- **Kluczowe sekcje**:
  1. **Brakujące materiały z magazynu (Auto-wykrywane)**:
     - Automatycznie generowana lista materiałów, których `quantity_stored < min_quantity`.
     - Możliwość jednym kliknięciem wygenerowania wniosku zakupowego na brakującą liczbę sztuk.
  2. **Lista wniosków zakupowych (Shopping List)**:
     - Ręczne zgłaszanie zapotrzebowania przez członków koła (link do Allegro/TME, sugerowana cena, ilość, kategoria).
     - Statusy zamówień: `Oczekuje` (pending) $\rightarrow$ `Zamówione` (ordered) $\rightarrow$ `Dostarczone` (received).
     - Akcja **"Przyjmij na stan magazynu"**: po odebraniu paczki kliknięcie tego przycisku automatycznie powiększa `quantity_stored` w magazynie i oznacza wniosek jako zrealizowany.
  3. **Podsumowanie budżetowe**:
     - Wyliczanie łącznej szacowanej kwoty zamówień oczekujących i w drodze.

---

### D. Lista Wyjazdów na Zawody ([`app/zawody/page.tsx`](../app/zawody/page.tsx))
- **Główny cel**: Rejestr wyjazdów (np. Shell Eco-marathon, Droniada, Formula Student).
- **Funkcje**:
  - Lista wydarzeń aktywnych i archiwalnych.
  - Modal dodawania nowego wyjazdu (nazwa, data rozpoczęcia).
  - Przejście do dedykowanego widoku pakowania wyjazdu (`/zawody/[id]`).

---

### E. Centrum Pakowania Wyjazdu ([`app/zawody/[id]/page.tsx`](../app/zawody/[id]/page.tsx))
- **Główny cel**: Cyfrowa checklista i logistyka fizycznego pakowania skrzyń.
- **Struktura ekranu**:
  1. **Nawigator Skrzyń Wyjazdowych (Boxes)**:
     - Skrzynie to lokalizacje w bazie o `type = 'event_box'` powiązane z danym `event_id`.
     - Możliwość tworzenia nowych skrzyń wyjazdowych (np. *"Skrzynia Elektryczna 1"*, *"Skrzynia Mechaniczna 2"*).
  2. **Pakowanie Sprzętu Trwałego (Durable Items)**:
     - Sprzęt przypisany na dany wyjazd.
     - Przycisk akcji: jednym kliknięciem zmiana statusu `Przypisany` $\leftrightarrow$ `Spakowany`.
     - Zmiana skrzyni docelowej lub zwrot sprzętu do warsztatu.
  3. **Zapotrzebowanie na Materiały (Event Consumables)**:
     - Określenie ile sztuk materiału jest wymagane na wyjazd (`quantity_required`) vs ile jest fizycznie spakowane (`quantity_packed`).
     - Przyciski `+` i `-`: spakowanie materiału do skrzyni **automatycznie odejmuje sztuki z magazynu głównego warsztatu**, chroniąc przed fałszywym stanem w bazie.
  4. **Zintegrowany Skaner Pakowania**:
     - Skanowanie naklejki z kodem kreskowym przy aktywnej skrzyni natychmiast oznacza sprzęt jako spakowany do tej skrzyni.

---

### F. Inteligentny Dyspozytor Kodów QR ([`app/skan/page.tsx`](../app/skan/page.tsx))
- **Główny cel**: Obsługa linków z fizycznych kodów QR naklejonych na narzędzia (`https://domena/skan?id=...`).
- **Inteligentne przekierowanie**:
  1. Odbiera parametr `?id=...` (SKU lub numer naklejki).
  2. Sprawdza w Supabase, czym jest zasób i gdzie się znajduje.
  3. **Jeśli sprzęt jest przypisany do aktywnej skrzyni wyjazdowej** $\rightarrow$ przekierowuje użytkownika bezpośrednio na stronę tych zawodów: `/zawody/[eventId]?open=[SKU]`.
  4. **Jeśli sprzęt jest w warsztacie stacjonarnym** $\rightarrow$ przekierowuje do głównego magazynu: `/magazyn?open=[SKU]`.
  5. W obu przypadkach strona docelowa natychmiast automatycznie otwiera modal edycji tego przedmiotu.

---

## 2. Kluczowe Komponenty Wielokrotnego Użytku

### A. `ScannerButton` ([`app/components/ScannerButton.tsx`](../app/components/ScannerButton.tsx))
- **Opis**: Uniwersalny przycisk uruchamiający pełnoekranowy skaner kamery oraz modal wpisywania ręcznego.
- **Props**:
  - `onScan: (scannedCode: string) => void` – funkcja wywoływana natychmiast po udanym odczycie kodu.
  - `buttonText?: string` – etykieta przycisku (domyślnie *"Zeskanuj / Wpisz ID"*).
  - `icon?: React.ElementType` – opcjonalna podmiana ikony (np. ikona `Barcode` w formularzach).
  - `className?: string` – klasy stylujące Tailwind.

### B. `ItemEditModal` ([`app/components/ItemEditModal.tsx`](../app/components/ItemEditModal.tsx))
- **Opis**: Zaawansowany modal do dodawania i edycji sprzętu trwałego.
- **Wbudowane mechanizmy**:
  - Automatyczne wyliczanie kolejnego wolnego kodu SKU (`suggestNextSku`) przy wyborze kategorii.
  - Zmiana kategorii dla istniejącego przedmiotu dynamicznie przelicza jego SKU.
  - Wbudowane pole `barcode` z dedykowanym przyciskiem kamery i synchronizacją węzła DOM.
  - Selektor lokalizacji z filtrowaniem skrzyń zależnie od wybranego wyjazdu.
  - Przycisk bezpiecznego usuwania przedmiotu z inwentarza.

### C. `SearchableSelect` ([`app/components/SearchableSelect.tsx`](../app/components/SearchableSelect.tsx))
- **Opis**: Responsywny, customowy komponent dropdownu z wbudowaną wyszukiwarką tekstową.
- **Zastosowanie**: Wybór szaf, półek i skrzyń w formularzach przy dużej liczbie rekordów.

### D. `Navbar` ([`app/components/Navbar.tsx`](../app/components/Navbar.tsx))
- **Opis**: Główny pasek nawigacyjny aplikacji z podświetlaniem aktywnej trasy, licznikiem i globalnym przyciskiem szybkiego skanowania.
