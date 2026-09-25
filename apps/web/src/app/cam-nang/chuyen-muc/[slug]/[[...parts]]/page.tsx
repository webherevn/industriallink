import {
  cmsCategoryPagePath,
  cmsCategoryPublicPath,
  cmsPostPublicPath,
} from '@industriallink/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { CmsBreadcrumb } from '@/components/cms-breadcrumb';
import {
  CmsBlogHero,
  CmsPagination,
  CmsPostCard,
  CmsPostEmpty,
} from '@/components/cms-blog';
import { CmsExpandableHtml } from '@/components/cms-expandable-html';
import { BRAND_NAME } from '@/lib/brand';
import { absolutizeCmsHtml, resolveCmsAssetUrl } from '@/lib/cms-assets';
import {
  buildBreadcrumbJsonLd,
  cmsRobotsMeta,
  formatCmsSeoTitle,
  stripHtml,
} from '@/lib/cms-seo';
import { fetchPublicCmsCategory, fetchPublishedCmsPostsPage } from '@/lib/public-cms-api';
import { siteUrl } from '@/lib/public-paths';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

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
    stripHtml(category.seoDescription || category.ogDescription || category.description) ||
    `Bài viết chuyên mục ${category.name} trên ${BRAND_NAME}`;

  const defaultPath = cmsCategoryPagePath(slug, pageNum);
  let canonicalPath =
    pageNum === 1 && category.canonicalPath
      ? category.canonicalPath
      : defaultPath;
  const canonical = canonicalPath.startsWith('http')
    ? canonicalPath
    : `${siteUrl()}${canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`}`;

  const ogImage = resolveCmsAssetUrl(
    category.ogImageUrl || category.avatarUrl,
  );

  const robots =
    pageNum > 1
      ? NOINDEX_ROBOTS
      : cmsRobotsMeta({
          robotsIndex: category.robotsIndex,
          robotsFollow: category.robotsFollow,
          robotsMaxImagePreview: category.robotsMaxImagePreview,
        });

  const ogTitle = category.ogTitle || category.seoTitle || category.name;
  const ogDesc =
    stripHtml(category.ogDescription || category.seoDescription || category.description) ||
    description;

  return {
    title: { absolute: title },
    description,
    robots,
    alternates: { canonical },
    openGraph: {
      title: ogTitle,
      description: ogDesc,
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630 }] : undefined,
      type: 'website',
      url: canonical,
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDesc,
      images: ogImage ? [ogImage] : undefined,
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
  const descriptionPlain = stripHtml(category.description || category.seoDescription);
  const descriptionHtml = category.description
    ? absolutizeCmsHtml(category.description)
    : '';
  const heroLead =
    descriptionPlain.length > 180
      ? `${descriptionPlain.slice(0, 177).trim()}…`
      : descriptionPlain || null;

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: category.seoTitle || category.name,
    description: stripHtml(category.seoDescription || category.description) || undefined,
    url: selfUrl,
    image: resolveCmsAssetUrl(category.ogImageUrl || category.avatarUrl) || undefined,
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

  const faqLd =
    category.faq?.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: category.faq.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: stripHtml(f.answer) },
          })),
        }
      : null;

  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: 'Trang chủ', url: `${base}/` },
    { name: 'Cẩm nang', url: `${base}/cam-nang` },
    { name: category.name, url: `${base}${cmsCategoryPublicPath(slug)}` },
    ...(pageNum > 1 ? [{ name: `Trang ${pageNum}`, url: selfUrl }] : []),
  ]);

  const prevHref = pageNum > 1 ? cmsCategoryPagePath(slug, pageNum - 1) : null;
  const nextHref = pageNum < list.totalPages ? cmsCategoryPagePath(slug, pageNum + 1) : null;

  return (
    <AppShell allowGuest flush bleed>
      {prevHref && <link rel="prev" href={`${base}${prevHref}`} />}
      {nextHref && <link rel="next" href={`${base}${nextHref}`} />}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}
      />
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <CmsBlogHero
        title={category.name}
        description={heroLead}
        eyebrow="Chuyên mục"
        avatarUrl={category.avatarUrl}
      />

      <div className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
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

          {descriptionHtml ? (
            <div className="mt-6">
              <CmsExpandableHtml html={descriptionHtml} />
            </div>
          ) : null}

          {list.items.length === 0 ? (
            <div className="mt-8">
              <CmsPostEmpty message="Chưa có bài trong chuyên mục này." />
            </div>
          ) : (
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {list.items.map((post) => (
                <li key={post.id}>
                  <CmsPostCard post={post} />
                </li>
              ))}
            </ul>
          )}

          <CmsPagination
            pageNum={pageNum}
            totalPages={list.totalPages}
            prevHref={prevHref}
            nextHref={nextHref}
          />

          {category.faq?.length > 0 && (
            <section className="mt-12 border-t border-slate-200 pt-10">
              <h2 className="text-xl font-bold text-[var(--brand-navy)]">
                Câu hỏi thường gặp
              </h2>
              <dl className="mt-5 space-y-3">
                {category.faq.map((f) => (
                  <div
                    key={f.question}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-4 sm:px-5"
                  >
                    <dt className="font-semibold text-slate-900">{f.question}</dt>
                    <dd className="mt-2 text-sm leading-relaxed text-slate-600">{f.answer}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      </div>
    </AppShell>
  );
}
