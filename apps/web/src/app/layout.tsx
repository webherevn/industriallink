import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { Providers } from '@/components/providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'inlink — Kết nối nhân tài, dẫn lối công nghiệp',
  description:
    'Kết nối nhân tài – Dẫn lối công nghiệp. Nền tảng tuyển dụng công nghiệp tích hợp AI.',
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png' }],
    apple: [{ url: '/favicon.png', type: 'image/png' }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={inter.variable}>
      {/* suppressHydrationWarning: extension trình duyệt có thể chèn style/attr vào body trước khi React hydrate */}
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
