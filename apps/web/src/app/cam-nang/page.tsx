import {
  cmsCategoryPublicPath,
  cmsPostPublicPath,
} from '@industriallink/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { CmsBreadcrumb } from '@/components/cms-breadcrumb';
import {
  CAM_NANG_INTRO,
  CAM_NANG_INTRO_DETAIL,
  CmsBlogHero,
  CmsCategoryChips,
  CmsPostCard,
  CmsPostEmpty,
} from '@/components/cms-blog';
import { BRAND_NAME } from '@/lib/brand';
import { buildBreadcrumbJsonLd, formatCmsSeoTitle } from '@/lib/cms-seo';
import { fetchPublicCmsCategories, fetchPublishedCmsPostsPage } from '@/lib/public-cms-api';
import { siteUrl } from '@/lib/public-paths';
import { INDEX_ROBOTS } from '@/lib/seo-robots';

export const revalidate = 60;

const PAGE_DESCRIPTION = `${CAM_NANG_INTRO} ${CAM_NANG_INTRO_DETAIL}`;

export const metadata: Metadata = {
  title: { absolute: formatCmsSeoTitle('Cẩm nang nghề nghiệp') },
  description: PAGE_DESCRIPTION,
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
  const [featured, ...rest] = posts;

  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: 'Trang chủ', url: `${base}/` },
    { name: 'Cẩm nang nghề nghiệp', url: `${base}/cam-nang` },
  ]);

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Cẩm nang nghề nghiệp',
    description: PAGE_DESCRIPTION,
    url: `${base}/cam-nang`,
    isPartOf: { '@type': 'WebSite', name: BRAND_NAME, url: base },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: posts.length,
      itemListElement: posts.map((post, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `${base}${cmsPostPublicPath(post.slug)}`,
        name: post.title,
      })),
    },
  };

  return (
    <AppShell allowGuest flush bleed>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}
      />

      <CmsBlogHero
        title="Cẩm nang nghề nghiệp"
        description={CAM_NANG_INTRO}
        descriptionExtra={CAM_NANG_INTRO_DETAIL}
      />

      <div className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <CmsBreadcrumb
            items={[{ name: 'Trang chủ', href: '/' }, { name: 'Cẩm nang nghề nghiệp' }]}
          />

          {categories.length > 0 && (
            <div className="mt-6">
              <CmsCategoryChips categories={categories} />
            </div>
          )}

          {posts.length === 0 ? (
            <div className="mt-8">
              <CmsPostEmpty message="Đang biên soạn nội dung. Quay lại sớm nhé." />
            </div>
          ) : (
            <div className="mt-8 space-y-8">
              {featured && <CmsPostCard post={featured} featured />}

              {rest.length > 0 && (
                <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((post) => (
                    <li key={post.id}>
                      <CmsPostCard post={post} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {categories.length > 0 && (
            <aside className="mt-12 rounded-2xl border border-accent-200/60 bg-accent-50/50 px-5 py-6 sm:px-7 sm:py-7">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent-700">
                Khám phá theo chủ đề
              </p>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={cmsCategoryPublicPath(c.slug)}
                      className="text-sm font-semibold text-brand-700 transition hover:text-accent-600"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </div>
    </AppShell>
  );
}
