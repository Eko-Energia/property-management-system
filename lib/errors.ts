type MaybePgError = { message?: string; code?: string; details?: string; hint?: string };

const CONSTRAINT_MESSAGES: Record<string, string> = {
  items_barcode_key: 'Ta etykieta jest już przypisana do innego sprzętu.',
  consumables_barcode_key: 'Ta etykieta jest już przypisana do innego materiału.',
  categories_code_key: 'Kategoria o takim kodzie już istnieje.',
  categories_name_key: 'Kategoria o takiej nazwie już istnieje.',
  categories_code_format: 'Kod kategorii: 2–4 wielkie litery lub cyfry (np. EL, NR, MECH).',
  items_link_format: 'Link musi zaczynać się od http:// lub https://.',
  consumables_link_format: 'Link musi zaczynać się od http:// lub https://.',
  shopping_link_format: 'Link musi zaczynać się od http:// lub https://.',
  event_consumables_unique: 'Ten materiał jest już w tej skrzyni.',
  shopping_open_per_consumable: 'Dla tego materiału jest już otwarte zgłoszenie zakupu.',
  events_dates: 'Data końca nie może być wcześniejsza niż data startu.',
  consumables_qty_nonneg: 'Stan magazynowy nie może być ujemny.',
};

/** Turns a Supabase/Postgres/network error into a short Polish message for a toast. */
export function errorMessage(err: unknown): string {
  if (!err) return 'Nieznany błąd';
  if (typeof err === 'string') return err;
  const e = err as MaybePgError;
  const msg = e.message ?? '';

  for (const [constraint, text] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (msg.includes(constraint) || e.details?.includes(constraint)) return text;
  }
  if (e.code === '42501' || /row-level security|permission denied/i.test(msg)) {
    return msg.startsWith('Brak') || msg.startsWith('Tylko') ? msg : 'Brak uprawnień do tej operacji.';
  }
  if (e.code === '23503') return 'Rekord jest powiązany z innymi danymi i nie można go usunąć.';
  if (/Failed to fetch|NetworkError|fetch failed/i.test(msg)) return 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.';
  // our own RAISE EXCEPTION messages are already user-facing Polish
  if (e.code === 'P0001' || e.code === 'P0002' || e.code === 'P0003' || e.code === '23505') return msg;
  return msg || 'Coś poszło nie tak';
}
