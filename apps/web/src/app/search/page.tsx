import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AppShell } from '@/components/app-shell';
import { SearchPageClient } from './search-page-client';

const TITLE = 'Tìm ứng viên AI theo tin tuyển dụng | inlink';
const DESCRIPTION =
  'Nhà tuyển dụng chọn tin đã đăng, bấm Tìm ngay để xem ứng viên xếp theo matching Kinh doanh hoặc Kỹ thuật của đúng tin đó. Bộ lọc tuỳ chọn dùng khi cần rà toàn mạng lưới.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'tìm ứng viên AI',
    'matching tuyển dụng',
    'nhà tuyển dụng B2B',
    'kỹ sư kinh doanh',
    'kỹ thuật công nghiệp',
    'inlink',
  ],
  alternates: { canonical: '/search' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    locale: 'vi_VN',
    type: 'website',
    url: '/search',
  },
  twitter: {
    card: 'summary',
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: false, follow: false },
};

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: TITLE,
  description: DESCRIPTION,
  inLanguage: 'vi-VN',
  url: '/search',
  isPartOf: {
    '@type': 'WebSite',
    name: 'inlink',
  },
  breadcrumb: {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: '/' },
      { '@type': 'ListItem', position: 2, name: 'Tìm ứng viên AI', item: '/search' },
    ],
  },
};

export default function SearchPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <Suspense
        fallback={
          <AppShell>
            <p className="py-16 text-center text-slate-500">Đang tải...</p>
          </AppShell>
        }
      >
        <SearchPageClient />
      </Suspense>
    </>
  );
}
