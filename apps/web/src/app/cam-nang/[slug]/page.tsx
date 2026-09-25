import { cmsPostPublicPath } from '@industriallink/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { BRAND_NAME } from '@/lib/brand';
import { absolutizeCmsHtml, resolveCmsAssetUrl } from '@/lib/cms-assets';
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
  const ogImage = resolveCmsAssetUrl(post.ogImageUrl || post.coverImageUrl);
  return {
    title: `${title} | ${BRAND_NAME}`,
    description,
    robots: robotsMeta(post),
    alternates: { canonical },
    openGraph: {
      title: post.ogTitle || title,
      description: post.ogDescription || description,
      images: ogImage ? [ogImage] : undefined,
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
  const authorAvatar = resolveCmsAssetUrl(post.authorAvatarUrl) || post.authorAvatarUrl || undefined;
  const socialLinks = [
    post.authorSocial?.website,
    post.authorSocial?.linkedin,
    post.authorSocial?.facebook,
    post.authorSocial?.twitter,
    post.authorSocial?.youtube,
  ].filter((u): u is string => Boolean(u));
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.seoDescription || post.excerpt || undefined,
    datePublished: post.publishedAt || post.createdAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: url,
    image: resolveCmsAssetUrl(post.ogImageUrl || post.coverImageUrl) || undefined,
    author: {
      '@type': 'Person',
      name: authorName,
      jobTitle: post.authorTitle || undefined,
      description: post.authorBio || undefined,
      image: authorAvatar,
      sameAs: socialLinks.length ? socialLinks : undefined,
      url: post.authorSocial?.website || undefined,
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
        {post.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveCmsAssetUrl(post.coverImageUrl) || post.coverImageUrl}
            alt={post.title}
            className="mt-6 w-full rounded-xl object-cover"
          />
        )}
        <div
          className="prose prose-slate mt-8 max-w-none"
          dangerouslySetInnerHTML={{ __html: absolutizeCmsHtml(post.bodyHtml) }}
        />

        {(post.authorName || post.authorBio || authorAvatar) && (
          <aside className="mt-10 flex gap-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
            {authorAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={authorAvatar}
                alt={authorName}
                className="h-16 w-16 shrink-0 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
                {authorName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Tác giả
              </p>
              <p className="text-base font-semibold text-slate-900">{authorName}</p>
              {post.authorTitle ? (
                <p className="text-sm text-slate-500">{post.authorTitle}</p>
              ) : null}
              {post.authorBio ? (
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{post.authorBio}</p>
              ) : null}
              {socialLinks.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-brand-600">
                  {post.authorSocial?.website && (
                    <li>
                      <a href={post.authorSocial.website} target="_blank" rel="noopener noreferrer">
                        Website
                      </a>
                    </li>
                  )}
                  {post.authorSocial?.linkedin && (
                    <li>
                      <a href={post.authorSocial.linkedin} target="_blank" rel="noopener noreferrer">
                        LinkedIn
                      </a>
                    </li>
                  )}
                  {post.authorSocial?.facebook && (
                    <li>
                      <a href={post.authorSocial.facebook} target="_blank" rel="noopener noreferrer">
                        Facebook
                      </a>
                    </li>
                  )}
                  {post.authorSocial?.twitter && (
                    <li>
                      <a href={post.authorSocial.twitter} target="_blank" rel="noopener noreferrer">
                        X
                      </a>
                    </li>
                  )}
                  {post.authorSocial?.youtube && (
                    <li>
                      <a href={post.authorSocial.youtube} target="_blank" rel="noopener noreferrer">
                        YouTube
                      </a>
                    </li>
                  )}
                </ul>
              )}
            </div>
          </aside>
        )}

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
