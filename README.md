# System Zarządzania Magazynem i Wyjazdami (Eko-Energia PMS)

Witaj w oficjalnej instrukcji użytkownika **Systemu Zarządzania Magazynem i Wyjazdami na Zawody**. System ten został stworzony z myślą o szybkim, mobilnym i bezproblemowym ewidencjonowaniu sprzętu trwałego oraz materiałów zużywalnych w bazie stacjonarnej oraz podczas wyjazdów na zawody.

---

## 📱 Najważniejsze Funkcje Systemu

System składa się z trzech głównych modułów połączonych wspólną wyszukiwarką oraz systemem skanowania kodów QR:

### 1. Panel Magazynu (Magazyn)
Główny punkt zarządzania zasobami. Dzieli się na dwie zakładki:
*   **Sprzęt Trwały (Items)** – narzędzia, urządzenia i maszyny wielokrotnego użytku (np. wkrętarka, lutownica, szlifierka). Każdy przedmiot ma swój indywidualny numer SKU, przypisanego opiekuna, status oraz lokalizację.
*   **Materiały Zużywalne (Consumables)** – przedmioty drobne, zliczane ilościowo (np. śruby, taśmy, frezy, cyna). System monitoruje ich stan magazynowy i ostrzega o niskim poziomie zapasów.

### 2. Panel Wyjazdów na Zawody (Zawody)
Pozwala przygotować ekwipunek na konkretne wydarzenie:
*   **Skrzynie wyjazdowe (Boxes)** – możliwość wirtualnego tworzenia skrzyń, do których pakowane są przedmioty.
*   **Pakowanie sprzętu** – przypisywanie narzędzi z warsztatu do konkretnych skrzyń.
*   **Zapotrzebowanie na materiały** – określenie ile sztuk danego materiału zużywalnego (np. 150 szt. śrub M3) jest wymagane na wyjazd, oraz śledzenie poziomu ich spakowania.

### 3. Lista Zakupów i Zapotrzebowanie
*   Automatycznie generuje listę brakujących materiałów, których stan spadł poniżej zdefiniowanego poziomu minimalnego.
*   Umożliwia zgłaszanie nowych wniosków zakupowych (np. link do Allegro, sugerowana cena, kategoria).
*   Pozwala jednym kliknięciem przyjąć zakupiony towar na stan magazynu.

---

## 🏷️ Struktura Identyfikatorów SKU

Każdy zasób w systemie posiada unikalny kod SKU ułatwiający identyfikację i generowanie kodów QR. Standardowy format SKU wygląda następująco:

[Typ]-[Kategoria]-[Numer]

### Przykłady:
*   `I-NR-0001` – **Przedmiot trwały** (`I` jak *Item*), kategoria **Narzędzia ręczne** (`NR`), numer `0001` (np. Dremel).
*   `C-EL-0002` – **Materiał zużywalny** (`C` jak *Consumable*), kategoria **Elektronika** (`EL`), numer `0002` (np. Cyna).

### Wyjaśnienie skrótów typu:
1.  **`I` (Items)** – Urządzenia trwałe. Posiadają statusy:
    *   `W warsztacie` – przedmiot znajduje się w bazie stacjonarnej.
    *   `Przypisany na zawody` – zadeklarowano chęć zabrania przedmiotu na wyjazd.
    *   `Spakowany` – przedmiot został fizycznie włożony do skrzyni wyjazdowej.
2.  **`C` (Consumables)** – Materiały zliczane ilościowo.

---

## 📷 Skanowanie i Tworzenie Kodów QR

System został zaprojektowany pod kątem **maksymalnej wygody na urządzeniach mobilnych**. 

### 1. Jak działają fizyczne kody QR na przedmiotach?
Kody QR naklejane na narzędzia i skrzynie są zakodowane jako pełne adresy URL:
```text
https://nasza-domena.pl/skan?id=[SKU]
```
*(np. `https://ekoenergia-pms.pl/skan?id=I-NR-0002`)*

### 2. Skanowanie bezpośrednio aparatem telefonu (Zalecane)
Nie musisz instalować żadnej dedykowanej aplikacji ani nawet otwierać przeglądarki przed skanowaniem:
1.  Uruchom **domyślny aparat fotograficzny** w swoim smartfonie (iOS lub Android).
2.  Nakieruj obiektyw na kod QR naklejony na przedmiocie.
3.  Kliknij w wyświetlony link.
4.  **Co się wydarzy?**
    *   Jeśli przedmiot jest stacjonarny w warsztacie $\rightarrow$ zostaniesz przekierowany do Magazynu, gdzie automatycznie otworzy się okno edycji tego przedmiotu.
    *   Jeśli przedmiot jest przypisany do wyjazdu na zawody $\rightarrow$ system automatycznie przeniesie Cię do widoku tych zawodów i od razu wyświetli modal edycji, byś mógł np. zmienić jego status na "Spakowany" lub zmienić skrzynię.

### 3. Skanowanie przyciskiem w aplikacji
W nagłówkach stron znajduje się przycisk **"Zeskanuj / Wpisz ID"**:
*   **Kamera w telefonie:** Umożliwia skanowanie bezpośrednio z poziomu otwartej strony.
*   **Wpisz ręcznie:** Jeśli aparat nie może wyostrzyć obrazu, kliknij zakładkę "Wpisz ręcznie" i wpisz sam kod (np. `I-NR-0002`) lub wklej cały link.

---

## 💡 Porady dla Użytkowników Smartfonów

Aplikacja została dostosowana do działania jak natywna aplikacja mobilna:

*   **Zamykanie Modali Gestem "Wstecz":** Jeśli otworzysz dowolne okno (modal) w aplikacji i użyjesz systemowego przycisku wstecz (lub wykonasz gest cofania na ekranie telefonu), system zamknie otwarte okno zamiast cofać Cię do poprzedniej strony.
*   **Blokada Przewijania Tła:** Podczas gdy okno edycji lub skanera jest otwarte, strona pod spodem nie przewija się, co zapobiega przypadkowemu gubieniu kontekstu pracy.
*   **Błąd zablokowanej kamery (HTTP vs HTTPS):** 
    > [!WARNING]
    > Przeglądarki internetowe na telefonach (Safari, Chrome) ze względów bezpieczeństwa blokują dostęp do kamery, jeśli strona nie posiada certyfikatu SSL (działa pod adresem `http://` zamiast `https://`).
    > 
    > Jeśli zobaczysz żółte ostrzeżenie: **"Przeglądarka blokuje kamerę. Użyj wpisywania ręcznego"**, oznacza to, że strona działa w trybie nieszyfrowanym. Skorzystaj wtedy z wpisywania ID ręcznie lub poproś administratora o włączenie certyfikatu SSL (HTTPS).
