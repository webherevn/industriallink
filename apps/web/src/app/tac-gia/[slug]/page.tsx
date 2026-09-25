import { cmsAuthorPublicPath, cmsAuthorSameAs } from '@industriallink/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { CmsBreadcrumb } from '@/components/cms-breadcrumb';
import { CmsPagination, CmsPostCard, CmsPostEmpty } from '@/components/cms-blog';
import { BRAND_NAME, BRAND_SITE_URL } from '@/lib/brand';
import { resolveCmsAssetUrl } from '@/lib/cms-assets';
import {
  buildBreadcrumbJsonLd,
  cmsRobotsMeta,
  formatCmsSeoTitle,
  stripHtml,
} from '@/lib/cms-seo';
import {
  fetchPublicCmsAuthor,
  fetchPublishedCmsPostsPage,
} from '@/lib/public-cms-api';
import { siteUrl } from '@/lib/public-paths';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const revalidate = 60;

const PAGE_SIZE = 12;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const author = await fetchPublicCmsAuthor(slug);
  if (!author) return { title: 'Không tìm thấy', robots: NOINDEX_ROBOTS };

  const titleBase =
    author.seoTitle ||
    [author.displayName, author.title].filter(Boolean).join(' · ') ||
    author.displayName;
  const title = formatCmsSeoTitle(titleBase);
  const description =
    stripHtml(author.seoDescription || author.bio) ||
    `Hồ sơ tác giả ${author.displayName} trên ${BRAND_NAME}`;
  const path = author.canonicalPath || cmsAuthorPublicPath(slug);
  const canonical = path.startsWith('http') ? path : `${siteUrl()}${path}`;
  const ogImage = resolveCmsAssetUrl(author.ogImageUrl || author.avatarUrl);

  return {
    title: { absolute: title },
    description,
    robots: cmsRobotsMeta(author),
    alternates: { canonical },
    openGraph: {
      title: author.ogTitle || titleBase,
      description:
        stripHtml(author.ogDescription || author.seoDescription || author.bio) || description,
      images: ogImage ? [{ url: ogImage, width: 400, height: 400 }] : undefined,
      type: 'profile',
      url: canonical,
    },
    twitter: {
      card: 'summary',
      title: author.ogTitle || titleBase,
      description:
        stripHtml(author.ogDescription || author.seoDescription || author.bio) || description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function AuthorPublicPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const pageNum = Math.max(1, Number(sp.page) || 1);

  const author = await fetchPublicCmsAuthor(slug);
  if (!author || !author.slug) notFound();

  const list = await fetchPublishedCmsPostsPage({
    author: slug,
    page: pageNum,
    limit: PAGE_SIZE,
  });
  if (pageNum > 1 && pageNum > list.totalPages) notFound();

  const base = siteUrl();
  const selfUrl = `${base}${cmsAuthorPublicPath(slug)}`;
  const avatar = resolveCmsAssetUrl(author.avatarUrl) || author.avatarUrl;
  const sameAs = cmsAuthorSameAs(author.social);
  const worksFor = author.worksFor || BRAND_NAME;

  const personLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.displayName,
    jobTitle: author.title || undefined,
    description: stripHtml(author.bio) || undefined,
    url: selfUrl,
    image: avatar || undefined,
    worksFor: { '@type': 'Organization', name: worksFor, url: BRAND_SITE_URL },
    sameAs: sameAs.length ? sameAs : undefined,
  };

  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: 'Trang chủ', url: `${base}/` },
    { name: 'Cẩm nang', url: `${base}/cam-nang` },
    { name: author.displayName, url: selfUrl },
  ]);

  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    name: author.displayName,
    url: selfUrl,
    mainEntity: personLd,
  };

  const prevHref = pageNum > 1 ? `${cmsAuthorPublicPath(slug)}?page=${pageNum - 1}` : null;
  const nextHref =
    pageNum < list.totalPages ? `${cmsAuthorPublicPath(slug)}?page=${pageNum + 1}` : null;

  return (
    <AppShell allowGuest flush bleed>
      {prevHref && <link rel="prev" href={`${base}${prevHref}`} />}
      {nextHref && <link rel="next" href={`${base}${nextHref}`} />}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <header className="relative overflow-hidden bg-[var(--brand-navy)] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 80% 60% at 100% 0%, #E8872A 0%, transparent 55%)',
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-300">
            Tác giả
          </p>
          <div className="brand-accent-bar mt-3" />
          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-white/20 bg-white/10 sm:h-28 sm:w-28">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatar}
                  alt={author.displayName}
                  width={112}
                  height={112}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white/40">
                  {author.displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {author.displayName}
              </h1>
              {author.title ? (
                <p className="mt-2 text-base font-medium text-accent-300">{author.title}</p>
              ) : null}
              <p className="mt-1 text-sm text-slate-300">{worksFor}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <CmsBreadcrumb
            items={[
              { name: 'Trang chủ', href: '/' },
              { name: 'Cẩm nang', href: '/cam-nang' },
              { name: author.displayName },
            ]}
          />

          {author.bio ? (
            <div className="mt-6 max-w-3xl">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
                Giới thiệu
              </h2>
              <p className="mt-2 whitespace-pre-line text-base leading-relaxed text-slate-700">
                {author.bio}
              </p>
            </div>
          ) : null}

          {sameAs.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-brand-600">
              {author.social.linkedin && (
                <li>
                  <a href={author.social.linkedin} target="_blank" rel="noopener noreferrer">
                    LinkedIn
                  </a>
                </li>
              )}
              {author.social.website && (
                <li>
                  <a href={author.social.website} target="_blank" rel="noopener noreferrer">
                    Website
                  </a>
                </li>
              )}
              {author.social.facebook && (
                <li>
                  <a href={author.social.facebook} target="_blank" rel="noopener noreferrer">
                    Facebook
                  </a>
                </li>
              )}
              {author.social.twitter && (
                <li>
                  <a href={author.social.twitter} target="_blank" rel="noopener noreferrer">
                    X
                  </a>
                </li>
              )}
              {author.social.youtube && (
                <li>
                  <a href={author.social.youtube} target="_blank" rel="noopener noreferrer">
                    YouTube
                  </a>
                </li>
              )}
            </ul>
          )}

          <section className="mt-10" aria-labelledby="author-posts-heading">
            <h2
              id="author-posts-heading"
              className="text-xl font-bold text-[var(--brand-navy)]"
            >
              Bài viết của {author.displayName}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{list.total} bài đã xuất bản</p>

            {list.items.length === 0 ? (
              <div className="mt-6">
                <CmsPostEmpty message="Chưa có bài viết công khai." />
              </div>
            ) : (
              <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
          </section>

          <p className="mt-10 text-sm">
            <Link href="/cam-nang" className="font-semibold text-brand-600 hover:text-accent-600">
              ← Tất cả cẩm nang
            </Link>
          </p>
        </div>
      </div>
    </AppShell>
  );
}
