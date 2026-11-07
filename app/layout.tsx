import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from '@/components/providers';
import { AppShell } from '@/components/app-shell';

const geistSans = localFont({ src: './fonts/GeistVF.woff', variable: '--font-geist-sans', weight: '100 900' });
const geistMono = localFont({ src: './fonts/GeistMonoVF.woff', variable: '--font-geist-mono', weight: '100 900' });

export const metadata: Metadata = {
  title: { default: 'Eko-Energia · Magazyn', template: '%s · Eko-Energia' },
  description: 'Inwentaryzacja sprzętu i materiałów oraz pakowanie skrzyń na wyjazdy koła Eko-Energia',
  applicationName: 'Eko-Energia PMS',
  appleWebApp: { capable: true, title: 'Eko-Energia', statusBarStyle: 'black-translucent' },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-dvh bg-zinc-950 font-sans text-zinc-100 antialiased`}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
