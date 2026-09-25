import { cmsPostPublicPath } from '@industriallink/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { BRAND_NAME } from '@/lib/brand';
import { fetchPublishedCmsPost } from '@/lib/public-cms-api';
import { siteUrl } from '@/lib/public-paths';
import { INDEX_ROBOTS, NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPublishedCmsPost(slug);
  if (!post) return { title: 'Không tìm thấy', robots: NOINDEX_ROBOTS };
  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt || undefined;
  const noindex = post.robots.includes('noindex');
  return {
    title: `${title} | ${BRAND_NAME}`,
    description,
    robots: noindex ? NOINDEX_ROBOTS : INDEX_ROBOTS,
    alternates: { canonical: post.canonicalPath || cmsPostPublicPath(post.slug) },
    openGraph: {
      title,
      description,
      images: post.ogImageUrl || post.coverImageUrl ? [post.ogImageUrl || post.coverImageUrl!] : undefined,
      type: 'article',
    },
  };
}

export default async function CareerGuideArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await fetchPublishedCmsPost(slug);
  if (!post) notFound();

  const base = siteUrl();
  const url = `${base}${cmsPostPublicPath(post.slug)}`;
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.seoDescription || post.excerpt || undefined,
    datePublished: post.publishedAt || post.createdAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: url,
    image: post.ogImageUrl || post.coverImageUrl || undefined,
    publisher: { '@type': 'Organization', name: BRAND_NAME, url: base },
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: `${base}/` },
      { '@type': 'ListItem', position: 2, name: 'Cẩm nang', item: `${base}/cam-nang` },
      { '@type': 'ListItem', position: 3, name: post.title, item: url },
    ],
  };

  return (
    <AppShell allowGuest>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <article className="mx-auto max-w-3xl">
        <Link href="/cam-nang" className="text-sm font-semibold text-brand-600">
          ← Cẩm nang nghề nghiệp
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">{post.title}</h1>
        <p className="mt-2 text-xs text-slate-400">
          {post.categoryName ? `${post.categoryName} · ` : ''}
          {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('vi-VN') : ''}
        </p>
        {post.excerpt && (
          <p className="mt-4 text-base leading-relaxed text-slate-600">{post.excerpt}</p>
        )}
        <div
          className="prose prose-slate mt-8 max-w-none"
          dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
        />
      </article>
    </AppShell>
  );
}
