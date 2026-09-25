import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import type { ReactNode } from 'react';
import { renderCmsHtmlSnippet } from '@/components/cms-html-snippet';
import { Providers } from '@/components/providers';
import { fetchPublicCmsSiteCode } from '@/lib/public-cms-api';
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

export default async function RootLayout({ children }: { children: ReactNode }) {
  const headerList = await headers();
  const pathname = headerList.get('x-pathname') || '';
  const skipInject =
    pathname.startsWith('/admin') || pathname.startsWith('/recruiter');

  const siteCode = skipInject ? null : await fetchPublicCmsSiteCode();
  const headerHtml =
    !skipInject && siteCode?.headerEnabled && siteCode.headerCode?.trim()
      ? siteCode.headerCode
      : null;
  const footerHtml =
    !skipInject && siteCode?.footerEnabled && siteCode.footerCode?.trim()
      ? siteCode.footerCode
      : null;

  return (
    <html lang="vi" className={inter.variable}>
      <head>{renderCmsHtmlSnippet(headerHtml)}</head>
      {/* suppressHydrationWarning: extension trình duyệt có thể chèn style/attr vào body trước khi React hydrate */}
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
        {renderCmsHtmlSnippet(footerHtml)}
      </body>
    </html>
  );
}
