import {
  cmsCategoryPublicPath,
  cmsPostPublicPath,
} from '@industriallink/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { CmsBreadcrumb } from '@/components/cms-breadcrumb';
import { BRAND_NAME } from '@/lib/brand';
import { buildBreadcrumbJsonLd, formatCmsSeoTitle } from '@/lib/cms-seo';
import { fetchPublicCmsCategories, fetchPublishedCmsPostsPage } from '@/lib/public-cms-api';
import { siteUrl } from '@/lib/public-paths';
import { INDEX_ROBOTS } from '@/lib/seo-robots';

export const revalidate = 60;

export const metadata: Metadata = {
  title: { absolute: formatCmsSeoTitle('Cẩm nang nghề nghiệp') },
  description: `Kiến thức, lộ trình và mẹo ứng tuyển cho nhân tài công nghiệp B2B trên ${BRAND_NAME}.`,
  robots: INDEX_ROBOTS,
  alternates: { canonical: '/cam-nang' },
};

export default async function CareerGuidePage() {
  const [list, categories] = await Promise.all([
    fetchPublishedCmsPostsPage({ page: 1, limit: 24 }),
    fetchPublicCmsCategories(),
  ]);
  const base = siteUrl();
  const posts = list.items;

  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: 'Trang chủ', url: `${base}/` },
    { name: 'Cẩm nang nghề nghiệp', url: `${base}/cam-nang` },
  ]);

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Cẩm nang nghề nghiệp',
    url: `${base}/cam-nang`,
    isPartOf: { '@type': 'WebSite', name: BRAND_NAME, url: base },
  };

  return (
    <AppShell allowGuest>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}
      />
      <div className="mx-auto max-w-3xl">
        <CmsBreadcrumb
          items={[{ name: 'Trang chủ', href: '/' }, { name: 'Cẩm nang nghề nghiệp' }]}
        />
        <h1 className="mt-4 text-3xl font-bold text-slate-900">Cẩm nang nghề nghiệp</h1>
        <p className="mt-2 text-sm text-slate-600">
          Kiến thức, lộ trình và mẹo ứng tuyển cho nhân tài công nghiệp B2B.
        </p>

        {categories.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href="/cam-nang"
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Tất cả
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={cmsCategoryPublicPath(c.slug)}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}

        <ul className="mt-8 space-y-4">
          {posts.length === 0 ? (
            <li className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">
              Đang biên soạn nội dung. Quay lại sớm nhé.
            </li>
          ) : (
            posts.map((post) => (
              <li key={post.id}>
                <Link
                  href={cmsPostPublicPath(post.slug)}
                  className="block rounded-xl border border-slate-200 bg-white px-5 py-4 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <h2 className="text-lg font-bold text-slate-900">{post.title}</h2>
                  {post.excerpt && (
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{post.excerpt}</p>
                  )}
                  <p className="mt-2 text-xs text-slate-400">
                    {post.categoryName ? (
                      <>
                        <span>{post.categoryName}</span>
                        {' · '}
                      </>
                    ) : null}
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString('vi-VN')
                      : ''}
                  </p>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </AppShell>
  );
}
