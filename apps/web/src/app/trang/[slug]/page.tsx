import { cmsPagePublicPath } from '@industriallink/contracts';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { BRAND_NAME } from '@/lib/brand';
import { fetchPublishedCmsPage } from '@/lib/public-cms-api';
import { siteUrl } from '@/lib/public-paths';
import { INDEX_ROBOTS, NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchPublishedCmsPage(slug);
  if (!page) return { title: 'Không tìm thấy', robots: NOINDEX_ROBOTS };
  const title = page.seoTitle || page.title;
  const description = page.seoDescription || page.excerpt || undefined;
  const noindex = page.robots.includes('noindex');
  return {
    title: `${title} | ${BRAND_NAME}`,
    description,
    robots: noindex ? NOINDEX_ROBOTS : INDEX_ROBOTS,
    alternates: { canonical: page.canonicalPath || cmsPagePublicPath(page.slug) },
    openGraph: {
      title,
      description,
      images: page.ogImageUrl || page.coverImageUrl ? [page.ogImageUrl || page.coverImageUrl!] : undefined,
      type: 'website',
    },
  };
}

export default async function StaticCmsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await fetchPublishedCmsPage(slug);
  if (!page) notFound();

  const base = siteUrl();
  const url = `${base}${cmsPagePublicPath(page.slug)}`;
  const webPageLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.title,
    description: page.seoDescription || page.excerpt || undefined,
    url,
    dateModified: page.updatedAt,
    isPartOf: { '@type': 'WebSite', name: BRAND_NAME, url: base },
  };

  return (
    <AppShell allowGuest>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageLd) }}
      />
      <article className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-slate-900">{page.title}</h1>
        {page.excerpt && (
          <p className="mt-3 text-base leading-relaxed text-slate-600">{page.excerpt}</p>
        )}
        <div
          className="prose prose-slate mt-8 max-w-none"
          dangerouslySetInnerHTML={{ __html: page.bodyHtml }}
        />
      </article>
    </AppShell>
  );
}
