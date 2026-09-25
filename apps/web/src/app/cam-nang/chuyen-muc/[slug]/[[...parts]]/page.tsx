import {
  cmsCategoryPagePath,
  cmsCategoryPublicPath,
  cmsPostPublicPath,
} from '@industriallink/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { CmsBreadcrumb } from '@/components/cms-breadcrumb';
import { BRAND_NAME } from '@/lib/brand';
import { resolveCmsAssetUrl } from '@/lib/cms-assets';
import { buildBreadcrumbJsonLd, formatCmsSeoTitle, stripHtml } from '@/lib/cms-seo';
import { fetchPublicCmsCategory, fetchPublishedCmsPostsPage } from '@/lib/public-cms-api';
import { siteUrl } from '@/lib/public-paths';
import { INDEX_ROBOTS, NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const revalidate = 60;

const PAGE_SIZE = 12;

type Props = {
  params: Promise<{ slug: string; parts?: string[] }>;
};

function parsePageNum(parts?: string[]): number {
  if (!parts || parts.length === 0) return 1;
  if (parts.length === 2 && parts[0] === 'page') {
    const n = Number(parts[1]);
    if (Number.isFinite(n) && n >= 1) return Math.floor(n);
  }
  return -1;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, parts } = await params;
  const pageNum = parsePageNum(parts);
  if (pageNum < 1) return { title: 'Không tìm thấy', robots: NOINDEX_ROBOTS };

  const category = await fetchPublicCmsCategory(slug);
  if (!category) return { title: 'Không tìm thấy', robots: NOINDEX_ROBOTS };

  const titleBase = category.seoTitle || category.name;
  const title =
    pageNum > 1
      ? formatCmsSeoTitle(`${titleBase} - Trang ${pageNum}`)
      : formatCmsSeoTitle(titleBase);
  const description =
    stripHtml(category.seoDescription || category.description) ||
    `Bài viết chuyên mục ${category.name} trên ${BRAND_NAME}`;
  const path = cmsCategoryPagePath(slug, pageNum);
  const canonical = `${siteUrl()}${path}`;
  const ogImage = resolveCmsAssetUrl(category.ogImageUrl);

  return {
    title: { absolute: title },
    description,
    robots: pageNum > 1 ? NOINDEX_ROBOTS : INDEX_ROBOTS,
    alternates: { canonical },
    openGraph: {
      title: titleBase,
      description,
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630 }] : undefined,
      type: 'website',
      url: canonical,
    },
  };
}

export default async function CmsCategoryPage({ params }: Props) {
  const { slug, parts } = await params;
  const pageNum = parsePageNum(parts);
  if (pageNum < 1) notFound();

  const category = await fetchPublicCmsCategory(slug);
  if (!category) notFound();

  const list = await fetchPublishedCmsPostsPage({
    category: slug,
    page: pageNum,
    limit: PAGE_SIZE,
  });

  if (pageNum > 1 && pageNum > list.totalPages) notFound();

  const base = siteUrl();
  const selfPath = cmsCategoryPagePath(slug, pageNum);
  const selfUrl = `${base}${selfPath}`;

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: category.name,
    description: stripHtml(category.seoDescription || category.description) || undefined,
    url: selfUrl,
    isPartOf: { '@type': 'WebSite', name: BRAND_NAME, url: base },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: list.total,
      itemListElement: list.items.map((post, i) => ({
        '@type': 'ListItem',
        position: (pageNum - 1) * PAGE_SIZE + i + 1,
        url: `${base}${cmsPostPublicPath(post.slug)}`,
        name: post.title,
      })),
    },
  };

  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: 'Trang chủ', url: `${base}/` },
    { name: 'Cẩm nang', url: `${base}/cam-nang` },
    { name: category.name, url: `${base}${cmsCategoryPublicPath(slug)}` },
    ...(pageNum > 1 ? [{ name: `Trang ${pageNum}`, url: selfUrl }] : []),
  ]);

  const prevHref = pageNum > 1 ? cmsCategoryPagePath(slug, pageNum - 1) : null;
  const nextHref = pageNum < list.totalPages ? cmsCategoryPagePath(slug, pageNum + 1) : null;

  return (
    <AppShell allowGuest>
      {prevHref && <link rel="prev" href={`${base}${prevHref}`} />}
      {nextHref && <link rel="next" href={`${base}${nextHref}`} />}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <div className="mx-auto max-w-3xl">
        <CmsBreadcrumb
          items={[
            { name: 'Trang chủ', href: '/' },
            { name: 'Cẩm nang', href: '/cam-nang' },
            {
              name: category.name,
              href: pageNum > 1 ? cmsCategoryPublicPath(slug) : undefined,
            },
            ...(pageNum > 1 ? [{ name: `Trang ${pageNum}` }] : []),
          ]}
        />
        <h1 className="mt-4 text-3xl font-bold text-slate-900">{category.name}</h1>
        {(category.description || category.seoDescription) && (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {stripHtml(category.description || category.seoDescription)}
          </p>
        )}

        <ul className="mt-8 space-y-4">
          {list.items.length === 0 ? (
            <li className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500">
              Chưa có bài trong chuyên mục này.
            </li>
          ) : (
            list.items.map((post) => (
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
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString('vi-VN')
                      : ''}
                  </p>
                </Link>
              </li>
            ))
          )}
        </ul>

        {list.totalPages > 1 && (
          <nav
            aria-label="Phân trang"
            className="mt-10 flex items-center justify-between border-t border-slate-200 pt-6 text-sm"
          >
            {prevHref ? (
              <Link href={prevHref} className="font-semibold text-brand-600 hover:text-brand-700">
                ← Trang trước
              </Link>
            ) : (
              <span />
            )}
            <span className="text-slate-500">
              Trang {pageNum} / {list.totalPages}
            </span>
            {nextHref ? (
              <Link href={nextHref} className="font-semibold text-brand-600 hover:text-brand-700">
                Trang sau →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </AppShell>
  );
}
