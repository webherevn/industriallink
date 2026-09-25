import {
  cmsAuthorPublicPath,
  cmsAuthorSameAs,
  cmsCategoryPublicPath,
  cmsPostPublicPath,
} from '@industriallink/contracts';
import type { CmsPostListItem } from '@industriallink/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { CmsBreadcrumb } from '@/components/cms-breadcrumb';
import { CmsRelatedPosts, formatViDate } from '@/components/cms-blog';
import { CmsTableOfContents } from '@/components/cms-toc';
import { BRAND_NAME } from '@/lib/brand';
import { absolutizeCmsHtml, resolveCmsAssetUrl } from '@/lib/cms-assets';
import {
  buildBreadcrumbJsonLd,
  cmsRobotsMeta,
  formatCmsSeoTitle,
  prepareCmsBodyHtml,
  stripHtml,
} from '@/lib/cms-seo';
import {
  fetchCmsRedirect,
  fetchPublishedCmsPost,
  fetchPublishedCmsPostsPage,
} from '@/lib/public-cms-api';
import { siteUrl } from '@/lib/public-paths';

export const revalidate = 60;

/** Tối đa 4 bài liên quan — hiện khi còn ≥1 bài khác (tức tổng ≥2 bài). */
async function fetchRelatedPosts(post: {
  id: string;
  slug: string;
  categorySlug: string | null;
}): Promise<CmsPostListItem[]> {
  const pick = (items: CmsPostListItem[]) =>
    items.filter((p) => p.id !== post.id && p.slug !== post.slug).slice(0, 4);

  if (post.categorySlug) {
    const byCat = await fetchPublishedCmsPostsPage({
      category: post.categorySlug,
      limit: 8,
      page: 1,
    });
    const related = pick(byCat.items);
    if (related.length > 0) return related;
  }

  // Fallback khi chưa gán chuyên mục hoặc mục chỉ có 1 bài
  const latest = await fetchPublishedCmsPostsPage({ limit: 8, page: 1 });
  return pick(latest.items);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await fetchPublishedCmsPost(slug);
  if (!post) return { title: 'Không tìm thấy', robots: { index: false, follow: false } };
  const title = formatCmsSeoTitle(post.seoTitle || post.title);
  const description = stripHtml(post.seoDescription || post.excerpt) || undefined;
  const path = post.canonicalPath || cmsPostPublicPath(post.slug);
  const canonical = path.startsWith('http') ? path : `${siteUrl()}${path}`;
  const ogImage = resolveCmsAssetUrl(post.ogImageUrl || post.coverImageUrl);
  return {
    title: { absolute: title },
    description,
    robots: cmsRobotsMeta(post),
    alternates: { canonical },
    openGraph: {
      title: post.ogTitle || post.seoTitle || post.title,
      description: stripHtml(post.ogDescription || post.seoDescription || post.excerpt) || undefined,
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630 }] : undefined,
      type: 'article',
      url: canonical,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.ogTitle || post.seoTitle || post.title,
      description: stripHtml(post.ogDescription || post.seoDescription || post.excerpt) || undefined,
      images: ogImage ? [ogImage] : undefined,
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

  const relatedPosts = await fetchRelatedPosts(post);

  const base = siteUrl();
  const url = `${base}${cmsPostPublicPath(post.slug)}`;
  const authorName = post.authorName || BRAND_NAME;
  const authorAvatar = resolveCmsAssetUrl(post.authorAvatarUrl) || post.authorAvatarUrl || undefined;
  const authorPublicPath = post.authorSlug ? cmsAuthorPublicPath(post.authorSlug) : null;
  const authorPublicUrl = authorPublicPath ? `${base}${authorPublicPath}` : null;
  const sameAs = cmsAuthorSameAs(post.authorSocial);
  const worksFor = post.authorWorksFor || BRAND_NAME;

  const rawHtml = absolutizeCmsHtml(post.bodyHtml);
  const { html: bodyHtml, toc } = prepareCmsBodyHtml(rawHtml, {
    siteOrigin: base,
    firstImageEager: !post.coverImageUrl,
  });

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: stripHtml(post.seoDescription || post.excerpt) || undefined,
    datePublished: post.publishedAt || post.createdAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: url,
    image: resolveCmsAssetUrl(post.ogImageUrl || post.coverImageUrl) || undefined,
    author: {
      '@type': 'Person',
      name: authorName,
      jobTitle: post.authorTitle || undefined,
      description: stripHtml(post.authorBio) || undefined,
      url: authorPublicUrl || undefined,
      image: authorAvatar || undefined,
      worksFor: { '@type': 'Organization', name: worksFor },
      sameAs: sameAs.length ? sameAs : undefined,
    },
    publisher: {
      '@type': 'Organization',
      name: BRAND_NAME,
      logo: {
        '@type': 'ImageObject',
        url: `${base}/logo.png`,
      },
    },
  };

  const faqLd =
    post.faq.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: post.faq.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: stripHtml(f.answer) },
          })),
        }
      : null;

  const crumbUrls: Array<{ name: string; url: string }> = [
    { name: 'Trang chủ', url: `${base}/` },
    { name: 'Cẩm nang', url: `${base}/cam-nang` },
  ];
  if (post.categorySlug && post.categoryName) {
    crumbUrls.push({
      name: post.categoryName,
      url: `${base}${cmsCategoryPublicPath(post.categorySlug)}`,
    });
  }
  crumbUrls.push({ name: post.title, url });

  const breadcrumbLd = buildBreadcrumbJsonLd(crumbUrls);

  const breadcrumbUi = [
    { name: 'Trang chủ', href: '/' },
    { name: 'Cẩm nang', href: '/cam-nang' },
    ...(post.categorySlug && post.categoryName
      ? [{ name: post.categoryName, href: cmsCategoryPublicPath(post.categorySlug) }]
      : []),
    { name: post.title },
  ];

  const publishedLabel = formatViDate(post.publishedAt);
  const showToc = toc.length >= 2;

  return (
    <AppShell allowGuest flush bleed>
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

      <article>
        {/* Title band — nền trắng */}
        <div className="border-b border-slate-200/80 bg-white">
          <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
            <CmsBreadcrumb items={breadcrumbUi} />

            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
              {post.categorySlug && post.categoryName ? (
                <Link
                  href={cmsCategoryPublicPath(post.categorySlug)}
                  className="rounded-md bg-accent-50 px-2.5 py-1 font-semibold text-accent-700 ring-1 ring-accent-200 transition hover:bg-accent-100"
                >
                  {post.categoryName}
                </Link>
              ) : null}
              {publishedLabel ? (
                <time
                  dateTime={post.publishedAt || undefined}
                  className="font-medium text-slate-400"
                >
                  {publishedLabel}
                </time>
              ) : null}
              <span className="font-medium text-slate-400">·</span>
              {authorPublicPath ? (
                <Link
                  href={authorPublicPath}
                  className="font-medium text-slate-500 transition hover:text-accent-600"
                >
                  {authorName}
                </Link>
              ) : (
                <span className="font-medium text-slate-500">{authorName}</span>
              )}
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-[var(--brand-navy)] sm:text-4xl lg:leading-tight">
              {post.title}
            </h1>
            {post.excerpt ? (
              <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
                {post.excerpt}
              </p>
            ) : null}
          </div>
        </div>

        {/* Content band — cùng nền trắng như tiêu đề */}
        <div className="bg-white">
          <div className="mx-auto max-w-3xl px-4 pb-12 pt-6 sm:px-6 sm:pb-14 sm:pt-8">
            {post.coverImageUrl && (
              <div className="mb-8 overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveCmsAssetUrl(post.coverImageUrl) || post.coverImageUrl}
                  alt={post.title}
                  width={1200}
                  height={630}
                  loading="eager"
                  decoding="async"
                  className="aspect-[2/1] w-full object-cover"
                />
              </div>
            )}

            {showToc && (
              <div className="mb-8">
                <CmsTableOfContents items={toc} />
              </div>
            )}

            <div
              className="cms-prose max-w-none"
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />

            {(post.authorName || post.authorBio || authorAvatar) && (
              <aside className="mt-12 flex gap-4 rounded-2xl border border-accent-200/70 bg-accent-50/40 p-5 sm:p-6">
                {authorAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={authorAvatar}
                    alt={authorName}
                    width={72}
                    height={72}
                    loading="lazy"
                    className="h-[72px] w-[72px] shrink-0 rounded-full border-2 border-white object-cover shadow-sm"
                  />
                ) : (
                  <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-[var(--brand-navy)] text-xl font-bold text-white shadow-sm">
                    {authorName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent-700">
                    Tác giả
                  </p>
                  {authorPublicPath ? (
                    <Link
                      href={authorPublicPath}
                      className="mt-1 block text-lg font-bold text-slate-900 transition hover:text-accent-600"
                    >
                      {authorName}
                    </Link>
                  ) : (
                    <p className="mt-1 text-lg font-bold text-slate-900">{authorName}</p>
                  )}
                  {post.authorTitle ? (
                    <p className="text-sm text-slate-500">{post.authorTitle}</p>
                  ) : null}
                  {post.authorBio ? (
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{post.authorBio}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                    {authorPublicPath ? (
                      <Link
                        href={authorPublicPath}
                        className="text-xs font-semibold text-brand-600 hover:text-accent-600"
                      >
                        Xem hồ sơ tác giả →
                      </Link>
                    ) : null}
                    {sameAs.length > 0 && (
                      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-brand-600">
                        {post.authorSocial?.linkedin && (
                          <li>
                            <a
                              href={post.authorSocial.linkedin}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-accent-600"
                            >
                              LinkedIn
                            </a>
                          </li>
                        )}
                        {post.authorSocial?.website && (
                          <li>
                            <a
                              href={post.authorSocial.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-accent-600"
                            >
                              Website
                            </a>
                          </li>
                        )}
                        {post.authorSocial?.facebook && (
                          <li>
                            <a
                              href={post.authorSocial.facebook}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-accent-600"
                            >
                              Facebook
                            </a>
                          </li>
                        )}
                        {post.authorSocial?.twitter && (
                          <li>
                            <a
                              href={post.authorSocial.twitter}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-accent-600"
                            >
                              X
                            </a>
                          </li>
                        )}
                        {post.authorSocial?.youtube && (
                          <li>
                            <a
                              href={post.authorSocial.youtube}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-accent-600"
                            >
                              YouTube
                            </a>
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              </aside>
            )}

            {post.faq.length > 0 && (
              <section className="mt-12 border-t border-slate-200 pt-10">
                <h2 className="text-xl font-bold text-[var(--brand-navy)]">
                  Câu hỏi thường gặp
                </h2>
                <dl className="mt-5 space-y-3">
                  {post.faq.map((f) => (
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

            <CmsRelatedPosts
              posts={relatedPosts}
              categoryName={post.categoryName}
              categoryHref={
                post.categorySlug ? cmsCategoryPublicPath(post.categorySlug) : null
              }
            />

            <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-8">
              <Link
                href="/cam-nang"
                className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-600 transition hover:border-accent-200 hover:text-brand-700"
              >
                ← Tất cả cẩm nang
              </Link>
              <Link
                href="/viec-lam"
                className="inline-flex items-center rounded-lg bg-[var(--brand-navy)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Tìm việc ngay
              </Link>
            </div>
          </div>
        </div>
      </article>
    </AppShell>
  );
}
