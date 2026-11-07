import { describe, expect, it } from 'vitest';
import { parseScannedCode } from './scan';
import { matchesQuery, plural, safeUrl } from './format';

describe('parseScannedCode', () => {
  it('extracts id from app QR links', () => {
    expect(parseScannedCode('https://ekoenergia-pms.vercel.app/skan?id=I-EL-0001')).toBe('I-EL-0001');
  });
  it('keeps raw label numbers and trims control chars', () => {
    expect(parseScannedCode('  2137420000000\r\n')).toBe('2137420000000');
    expect(parseScannedCode('00045')).toBe('00045');
  });
  it('returns null for empty input and keeps URLs without id', () => {
    expect(parseScannedCode('   ')).toBeNull();
    expect(parseScannedCode('https://allegro.pl/x')).toBe('https://allegro.pl/x');
  });
});

describe('format helpers', () => {
  it('polish plurals', () => {
    expect([1, 2, 5, 12, 22, 25].map((n) => plural(n, ['sztuka', 'sztuki', 'sztuk']))).toEqual([
      'sztuka', 'sztuki', 'sztuk', 'sztuk', 'sztuki', 'sztuk',
    ]);
  });
  it('search ignores case, diacritics and word order', () => {
    expect(matchesQuery('lutownica zolta', 'Żółta LUTOWNICA', 'I-NR-0001')).toBe(true);
    expect(matchesQuery('nr-0001', 'Lutownica', 'I-NR-0001')).toBe(true);
    expect(matchesQuery('multimetr', 'Lutownica')).toBe(false);
  });
  it('safeUrl blocks javascript: links', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('https://tme.eu/x')).toBe('https://tme.eu/x');
  });
});
