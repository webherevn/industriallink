import { cmsPagePublicPath } from '@industriallink/contracts';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { BRAND_NAME } from '@/lib/brand';
import { absolutizeCmsHtml, resolveCmsAssetUrl } from '@/lib/cms-assets';
import { fetchCmsRedirect, fetchPublishedCmsPage } from '@/lib/public-cms-api';
import { siteUrl } from '@/lib/public-paths';

export const revalidate = 60;

function robotsMeta(page: {
  robotsIndex: boolean;
  robotsFollow: boolean;
  robotsMaxImagePreview: boolean;
}): Metadata['robots'] {
  return {
    index: page.robotsIndex,
    follow: page.robotsFollow,
    'max-image-preview': page.robotsMaxImagePreview ? 'large' : 'standard',
  } as Metadata['robots'];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchPublishedCmsPage(slug);
  if (!page) return { title: 'Không tìm thấy', robots: { index: false, follow: false } };
  const title = page.seoTitle || page.title;
  const description = page.seoDescription || page.excerpt || undefined;
  const path = page.canonicalPath || cmsPagePublicPath(page.slug);
  const canonical = path.startsWith('http') ? path : `${siteUrl()}${path}`;
  const ogImage = resolveCmsAssetUrl(page.ogImageUrl || page.coverImageUrl);
  return {
    title: `${title} | ${BRAND_NAME}`,
    description,
    robots: robotsMeta(page),
    alternates: { canonical },
    openGraph: {
      title: page.ogTitle || title,
      description: page.ogDescription || description,
      images: ogImage ? [ogImage] : undefined,
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
  if (!page) {
    const redir = await fetchCmsRedirect(cmsPagePublicPath(slug));
    if (redir?.toPath) permanentRedirect(redir.toPath);
    notFound();
  }

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
    author: page.authorName
      ? {
          '@type': 'Person',
          name: page.authorName,
          jobTitle: page.authorTitle || undefined,
        }
      : undefined,
  };
  const faqLd =
    page.faq.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: page.faq.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        }
      : null;

  return (
    <AppShell allowGuest>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageLd) }}
      />
      {faqLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
        />
      )}
      <article className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-slate-900">{page.title}</h1>
        {page.excerpt && (
          <p className="mt-3 text-base leading-relaxed text-slate-600">{page.excerpt}</p>
        )}
        {page.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveCmsAssetUrl(page.coverImageUrl) || page.coverImageUrl}
            alt={page.title}
            className="mt-6 w-full rounded-xl object-cover"
          />
        )}
        <div
          className="prose prose-slate mt-8 max-w-none"
          dangerouslySetInnerHTML={{ __html: absolutizeCmsHtml(page.bodyHtml) }}
        />
        {page.faq.length > 0 && (
          <section className="mt-10 border-t border-slate-200 pt-8">
            <h2 className="text-xl font-bold text-slate-900">Câu hỏi thường gặp</h2>
            <dl className="mt-4 space-y-4">
              {page.faq.map((f) => (
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
