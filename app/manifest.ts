import type { MetadataRoute } from 'next';

// Installable on phones ("Dodaj do ekranu głównego"): full-screen, no browser chrome.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Eko-Energia · Magazyn',
    short_name: 'Eko-Energia',
    description: 'Inwentaryzacja i pakowanie skrzyń koła Eko-Energia',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#09090b',
    lang: 'pl',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
