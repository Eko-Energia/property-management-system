/**
 * Normalises what a scanner/keyboard produced into a lookup code:
 * - QR with an app link (…/skan?id=XYZ) -> "XYZ"
 * - anything else -> trimmed raw value (Code 128 label number or SKU)
 */
export function parseScannedCode(raw: string): string | null {
  const trimmed = raw.replace(/[\u0000-\u001f]/g, '').trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const id = new URL(trimmed).searchParams.get('id');
      if (id?.trim()) return id.trim();
    } catch {
      // not a valid URL, fall through
    }
  }
  return trimmed;
}

/**
 * Only Code 128 and QR: other 1D symbologies (ITF, EAN-8, Code 39, UPC-E)
 * produced false partial reads of our Code 128 labels. Don't extend this.
 */
export const SCAN_FORMATS = ['code_128', 'qr_code'] as const;
