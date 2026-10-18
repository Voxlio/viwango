import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

/**
 * Inter is loaded through `next/font`, which self-hosts it at build time — no
 * runtime request to Google, no layout shift, and it works the same on Vercel.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'VIWANGO — Floors & ceilings for any asset',
  description:
    'Type a symbol and see the price zones where the market has repeatedly turned. Floors and ceilings computed from plain candle maths — no AI, no signals, no predictions.',
  applicationName: 'VIWANGO',
  keywords: ['support', 'resistance', 'floors', 'ceilings', 'zones', 'candlestick', 'levels'],
};

export const viewport: Viewport = {
  themeColor: '#07070A',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh bg-ink-950 font-sans text-white antialiased">{children}</body>
    </html>
  );
}
