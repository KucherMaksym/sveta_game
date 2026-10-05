import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Manrope, Unbounded } from 'next/font/google';
import './globals.css';

const unbounded = Unbounded({ subsets: ['latin', 'cyrillic'], weight: ['500', '700', '900'], variable: '--font-unbounded' });
const manrope = Manrope({ subsets: ['latin', 'cyrillic'], weight: ['500', '700', '800'], variable: '--font-manrope' });
const jetbrains = JetBrains_Mono({ subsets: ['latin', 'cyrillic'], weight: ['500', '700'], variable: '--font-jetbrains' });

export const metadata: Metadata = {
  title: 'Слепой, Глухой, Немой',
  description: 'Игра на троих: один не говорит, другой не слышит, третий не видит. Вместе угадайте загадку.',
};

export const viewport: Viewport = { themeColor: '#f6f1e7' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${unbounded.variable} ${manrope.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
