import { cmsPostPublicPath } from '@industriallink/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { BRAND_NAME } from '@/lib/brand';
import { fetchCmsRedirect, fetchPublishedCmsPost } from '@/lib/public-cms-api';
import { siteUrl } from '@/lib/public-paths';

export const revalidate = 60;

function robotsMeta(post: {
  robotsIndex: boolean;
  robotsFollow: boolean;
  robotsMaxImagePreview: boolean;
}): Metadata['robots'] {
  return {
    index: post.robotsIndex,
    follow: post.robotsFollow,
    'max-image-preview': post.robotsMaxImagePreview ? 'large' : 'standard',
  } as Metadata['robots'];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPublishedCmsPost(slug);
  if (!post) return { title: 'Không tìm thấy', robots: { index: false, follow: false } };
  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.excerpt || undefined;
  const path = post.canonicalPath || cmsPostPublicPath(post.slug);
  const canonical = path.startsWith('http') ? path : `${siteUrl()}${path}`;
  return {
    title: `${title} | ${BRAND_NAME}`,
    description,
    robots: robotsMeta(post),
    alternates: { canonical },
    openGraph: {
      title: post.ogTitle || title,
      description: post.ogDescription || description,
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
  if (!post) {
    const redir = await fetchCmsRedirect(cmsPostPublicPath(slug));
    if (redir?.toPath) permanentRedirect(redir.toPath);
    notFound();
  }

  const base = siteUrl();
  const url = `${base}${cmsPostPublicPath(post.slug)}`;
  const authorName = post.authorName || BRAND_NAME;
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.seoDescription || post.excerpt || undefined,
    datePublished: post.publishedAt || post.createdAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: url,
    image: post.ogImageUrl || post.coverImageUrl || undefined,
    author: {
      '@type': 'Person',
      name: authorName,
      jobTitle: post.authorTitle || undefined,
      description: post.authorBio || undefined,
    },
    publisher: { '@type': 'Organization', name: BRAND_NAME, url: base },
  };
  const faqLd =
    post.faq.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: post.faq.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        }
      : null;
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
      <article className="mx-auto max-w-3xl">
        <Link href="/cam-nang" className="text-sm font-semibold text-brand-600">
          ← Cẩm nang nghề nghiệp
        </Link>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">{post.title}</h1>
        <p className="mt-2 text-xs text-slate-400">
          {authorName}
          {post.authorTitle ? ` · ${post.authorTitle}` : ''}
          {post.categoryName ? ` · ${post.categoryName}` : ''}
          {post.publishedAt
            ? ` · ${new Date(post.publishedAt).toLocaleDateString('vi-VN')}`
            : ''}
        </p>
        {post.excerpt && (
          <p className="mt-4 text-base leading-relaxed text-slate-600">{post.excerpt}</p>
        )}
        <div
          className="prose prose-slate mt-8 max-w-none"
          dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
        />
        {post.faq.length > 0 && (
          <section className="mt-10 border-t border-slate-200 pt-8">
            <h2 className="text-xl font-bold text-slate-900">Câu hỏi thường gặp</h2>
            <dl className="mt-4 space-y-4">
              {post.faq.map((f) => (
                <div key={f.question}>
                  <dt className="font-semibold text-slate-900">{f.question}</dt>
                  <dd className="mt-1 text-sm text-slate-600">{f.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </article>
    </AppShell>
  );
}
