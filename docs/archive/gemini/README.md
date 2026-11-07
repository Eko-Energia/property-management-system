# 📖 Eko-Energia PMS — Przewodnik dla Dewelopera i AI (Executive Summary)

> **Przeczytaj ten plik jako pierwszy, jeśli jesteś nowym deweloperem lub agentem AI wdrożonym w ten projekt.**  
> Ten dokument to Twoja mapa drogowa, spis zasad, architektury i pułapek, które musisz znać przed dotknięciem jakiegokolwiek pliku w repozytorium.

---

## 🎯 Czym jest ta aplikacja?

**Eko-Energia Property Management System (PMS)** to webowa aplikacja mobilno-desktopowa stworzona dla koła naukowego/zespołu inżynierskiego (Eko-Energia). Służy do:
1. **Ewidencji magazynowej warsztatu**: zarządzanie sprzętem trwałym (elektronarzędzia, maszyny, aparatura) oraz materiałami zużywalnymi (śruby, taśmy, cyna, komponenty elektroniczne).
2. **Logistyki wyjazdowej na zawody**: wirtualne tworzenie skrzyń wyjazdowych (*event boxes*), przydzielanie sprzętu na wyjazdy, deklarowanie zapotrzebowania na materiały i śledzenie stanu fizycznego spakowania.
3. **Zarządzania zakupami**: automatyczne wykrywanie braków magazynowych (stan poniżej minimum), zgłaszanie wniosków zakupowych (linki, szacowane koszty) i wprowadzanie dostaw do bazy jednym kliknięciem.
4. **Obsługi kodów kreskowych 1D (Code 128) oraz 2D (kody QR)**: natychmiastowa identyfikacja sprzętu kamerą telefonu w trudnych warsztatowych warunkach (odblaski, słabe światło, odległość).

---

## 🛠️ Stack Technologiczny

| Warstwa | Technologia | Wersja / Uwagi |
| :--- | :--- | :--- |
| **Framework** | Next.js (App Router) | `14.2.35` |
| **Język** | TypeScript | `^5` |
| **Styling** | Tailwind CSS | `^3.4.1` (Ciemny motyw w standardzie: zinc-900 / zinc-950) |
| **Baza danych** | Supabase (PostgreSQL) | `@supabase/supabase-js ^2.107.0` |
| **Realtime** | Supabase Realtime Channels | WebSockets (`postgres_changes`) |
| **Skaner kodów** | Natywne `BarcodeDetector` API + `html5-qrcode` fallback | Sprzętowa akceleracja GPU + obsługa 1080p |
| **Ikony** | `lucide-react` | `^1.17.0` |

---

## 🧭 Spis Dokumentacji w folderze `docs/`

Przejdź do dedykowanych dokumentów w zależności od zadania, które masz wykonać:

1. [**`docs/ARCHITECTURE.md`**](./ARCHITECTURE.md)  
   *Szczegółowa architektura systemu, przepływ danych, model Client Component (`'use client'`), system podwójny (Supabase Live vs Tryb Demo/Mock), synchronizacja Realtime, wzorce mobilne (popstate, scroll-lock, haptyka).*

2. [**`docs/DATABASE_SCHEMA.md`**](./DATABASE_SCHEMA.md)  
   *Pełny schemat bazy PostgreSQL/Supabase, skrypt DDL do odtworzenia tabel, relacje, klucze obce, formaty SKU (`I-CODE-0000`, `C-CODE-0000`), obsługa kodów `barcode` oraz kategoria specjalna `BK` ("Bez kategorii").*

3. [**`docs/BARCODE_AND_SCANNING.md`**](./BARCODE_AND_SCANNING.md)  
   *Kompendium skanowania: dlaczego tylko Code 128 i QR Code (ochrona przed False Positive / Partial Read), hardware acceleration przez GPU `BarcodeDetector`, lifecycle kamery na smartfonach, omijanie problemu utraty stanu Reacta.*

4. [**`docs/MODULES_AND_PAGES.md`**](./MODULES_AND_PAGES.md)  
   *Opis każdej podstrony (`/`, `/magazyn`, `/magazyn/zakupy`, `/zawody`, `/zawody/[id]`, `/skan`) oraz kluczowych komponentów (`ScannerButton`, `ItemEditModal`, `SearchableSelect`).*

5. [**`docs/KNOWN_ISSUES_AND_PITFALLS.md`**](./KNOWN_ISSUES_AND_PITFALLS.md)  
   *🔥 **NAJWAŻNIEJSZY DOKUMENT DLA AI!** Zbiór rozwiązanych krytycznych błędów i pułapek. Przeczytaj, aby ich przypadkowo nie przywrócić (np. błąd kompilatora SWC przy Next.js caching, zamykanie modala przy wyłączaniu kamery, fałszywe odczyty kodów kreskowych).*

6. [**`docs/DEVELOPER_CHEATSHEET.md`**](./DEVELOPER_CHEATSHEET.md)  
   *Komendy CLI, uruchamianie deweloperskie, budowanie produkcyjne, konfiguracja zmiennych środowiskowych, checklist przed zatwierdzeniem zmian.*

---

## ⚡ 5 Złotych Zasad dla Agentów AI pracujących z tym projektem

1. **NIGDY nie eksportuj konfiguracji tras Next.js (`revalidate`, `dynamic`) w plikach z `'use client'`!**  
   Kompilator SWC zamienia eksporty w obiekty, co natychmiast wysadza `next build` z błędem `Invalid revalidate value "[object Object]"`. Świeżość danych obsługujemy po stronie klienta (`visibilitychange` + `focus` + Supabase Realtime).
2. **NIGDY nie rozszerzaj białej listy formatów skanera o formaty krótkie (`ean_8`, `itf`, `upc_e`, `code_39`, `ean_13`) bez wyraźnej prośby!**  
   Powodują one błędy typu *Partial Read / False Positive* — naklejka Code 128 (np. 13 cyfr) jest ucinana w ułamku sekundy i interpretowana jako przypadkowy ciąg 8-cyfrowy. Dozwolone są **tylko** `code_128` i `qr_code`.
3. **Pamiętaj o Trybie Demo (Offline Mock Fallback)!**  
   Aplikacja działa w pełni nawet bez poprawnych kluczy do Supabase (np. podczas testów lokalnych czy braku internetu). Każda operacja zapisu/edycji/usuwania w kodzie musi mieć obsługę gałęzi `if (isDemoMode) { ... }`.
4. **Zmiana kategorii przedmiotu trwałego lub materiału ZAWSZE musi przeliczać SKU!**  
   Gdy użytkownik edytuje istniejący przedmiot i zmienia kategorię (np. z "Bez kategorii" `BK` na "Elektronika" `EL`), aplikacja musi automatycznie wygenerować i przypisać nowy wolny identyfikator (np. `I-EL-0004`).
5. **Po KAŻDEJ zmianie w kodzie ZAWSZE uruchom `npm run build`!**  
   Samo przejście TypeScriptu w edytorze nie gwarantuje, że optymalizator Next.js oraz SSR/prerender przejdą pomyślnie. Build musi zakończyć się kodem wyjścia `0`.
