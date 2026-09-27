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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var KEY='il_chunk_reloaded_at';function stale(m){return /ChunkLoadError|Loading(?:\\s+CSS)?\\s+chunk|dynamically imported module|Importing a module script failed|reading ['"]call['"]/i.test(m||'');}function recover(){try{var now=Date.now();var last=Number(sessionStorage.getItem(KEY)||'0');if(now-last<10000)return;sessionStorage.setItem(KEY,String(now));var u=new URL(location.href);u.searchParams.set('_r',String(now));location.replace(u.toString());}catch(e){location.reload();}}window.addEventListener('error',function(e){var t=e.target;if(t&&t.tagName==='SCRIPT'&&String(t.src||'').indexOf('/_next/static/')!==-1){recover();return;}if(stale(e.message))recover();},true);window.addEventListener('unhandledrejection',function(e){var r=e.reason;if(stale(r&&(r.message||String(r))))recover();});})();`,
          }}
        />
        {renderCmsHtmlSnippet(headerHtml)}
      </head>
      {/* suppressHydrationWarning: extension trình duyệt có thể chèn style/attr vào body trước khi React hydrate */}
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
        {renderCmsHtmlSnippet(footerHtml)}
      </body>
    </html>
  );
}
