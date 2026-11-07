# Eko-Energia PMS: magazyn i wyjazdy koła

Inwentaryzacja sprzętu i materiałów koła naukowego Eko-Energia (AGH) oraz pakowanie skrzyń na zawody.
Działa w przeglądarce na telefonie i komputerze; można ją dodać do ekranu głównego jak aplikację.

**Produkcja:** https://ekoenergia-pms.vercel.app

## Dla członków koła

1. **Konto:** „Kontynuuj z Google” albo email + hasło. Logujesz się raz na urządzeniu.
2. **Kod koła:** przy pierwszym logowaniu wpisz kod od zarządu (albo otwórz link zaproszenia z grupy).
3. **Skanuj:** niebieski przycisk na dole ekranu. Zeskanowanie naklejki otwiera przedmiot tam, gdzie akurat jest (magazyn albo wyjazd).
   Nowa naklejka z rolki → „Nowy sprzęt / Nowy materiał / Przypisz do istniejącego”.

### Co gdzie

| Moduł | Do czego |
|---|---|
| **Magazyn** | Sprzęt (każdy egzemplarz osobno) i materiały (liczone w sztukach, szybkie ±). Filtry, „pod moją opieką”, historia zmian każdej rzeczy |
| **Wyjazdy** | Wyjazd → skrzynie → pakowanie skanerem (seria skanów bez zamykania kamery) → po powrocie rozliczenie: co wróciło, co zginęło, ile materiałów zużyto |
| **Zakupy** | Braki trafiają tu automatycznie. Własne zgłoszenia, „zamówione”, „przyjmij dostawę” (stan rośnie sam) |
| **Ustawienia** | Profil, miejsca w magazynie, kategorie; admin: kod koła i role |

### Etykiety

Koło ma rolkę gotowych naklejek z kodami kreskowymi (Code 128). Nowemu przedmiotowi **przypisuje się istniejącą naklejkę**.
Jedna wartość może być przypisana tylko do jednej rzeczy: jeśli zeskanujesz zajętą, system pokaże gdzie jest i zaproponuje przeniesienie.
SKU (`I-EL-0001`: **I**tem/**C**onsumable – kategoria – numer) nadaje system automatycznie.

## Dla developerów

```bash
npm ci
cp .env.example .env.local
npm run dev
npm run check     # typecheck + lint + testy (unit + migracje/RLS/RPC na PGlite)
```

Stack: Next.js 16 · React 19 · TanStack Query · Supabase (Postgres, Auth, Realtime, RLS) · Vercel.

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): jak to jest zbudowane i dlaczego
- [docs/DATABASE.md](docs/DATABASE.md): schemat, RPC, automatyzacje, jak zmieniać schemat
- [docs/OPERATIONS.md](docs/OPERATIONS.md): konfiguracja Supabase/Vercel, pierwsze uruchomienie, backupy
- [docs/PITFALLS.md](docs/PITFALLS.md): zweryfikowane pułapki (skaner, Next, Postgres)
