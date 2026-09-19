import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-manrope',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Elmira Fətəliyeva – Rəqəm Sistemləri Onlayn Sınaq',
  description:
    'Rəqəm Sistemləri üzrə 25 suallıq onlayn sınaq. Müəllimə Elmira Fətəliyeva.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2563EB',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az">
      <body className={`${manrope.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
