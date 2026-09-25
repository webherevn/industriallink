import { cmsPagePublicPath } from '@industriallink/contracts';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { CmsBreadcrumb } from '@/components/cms-breadcrumb';
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
import { fetchCmsRedirect, fetchPublishedCmsPage } from '@/lib/public-cms-api';
import { siteUrl } from '@/lib/public-paths';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await fetchPublishedCmsPage(slug);
  if (!page) return { title: 'Không tìm thấy', robots: { index: false, follow: false } };
  const title = formatCmsSeoTitle(page.seoTitle || page.title);
  const description = stripHtml(page.seoDescription || page.excerpt) || undefined;
  const path = page.canonicalPath || cmsPagePublicPath(page.slug);
  const canonical = path.startsWith('http') ? path : `${siteUrl()}${path}`;
  const ogImage = resolveCmsAssetUrl(page.ogImageUrl || page.coverImageUrl);
  return {
    title: { absolute: title },
    description,
    robots: cmsRobotsMeta(page),
    alternates: { canonical },
    openGraph: {
      title: page.ogTitle || page.seoTitle || page.title,
      description: stripHtml(page.ogDescription || page.seoDescription || page.excerpt) || undefined,
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630 }] : undefined,
      type: 'website',
      url: canonical,
    },
    twitter: {
      card: 'summary_large_image',
      title: page.ogTitle || page.seoTitle || page.title,
      description: stripHtml(page.ogDescription || page.seoDescription || page.excerpt) || undefined,
      images: ogImage ? [ogImage] : undefined,
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
  const rawHtml = absolutizeCmsHtml(page.bodyHtml);
  const { html: bodyHtml, toc } = prepareCmsBodyHtml(rawHtml, {
    siteOrigin: base,
    firstImageEager: !page.coverImageUrl,
  });

  const webPageLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.title,
    description: stripHtml(page.seoDescription || page.excerpt) || undefined,
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
            acceptedAnswer: { '@type': 'Answer', text: stripHtml(f.answer) },
          })),
        }
      : null;

  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: 'Trang chủ', url: `${base}/` },
    { name: page.title, url },
  ]);

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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <article className="mx-auto max-w-3xl">
        <CmsBreadcrumb
          items={[{ name: 'Trang chủ', href: '/' }, { name: page.title }]}
        />
        <h1 className="mt-4 text-3xl font-bold text-slate-900">{page.title}</h1>
        {page.excerpt && (
          <p className="mt-3 text-base leading-relaxed text-slate-600">{page.excerpt}</p>
        )}
        {page.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveCmsAssetUrl(page.coverImageUrl) || page.coverImageUrl}
            alt={page.title}
            width={1200}
            height={630}
            loading="eager"
            decoding="async"
            className="mt-6 h-auto w-full rounded-xl object-cover"
          />
        )}
        {toc.length >= 2 && (
          <div className="mt-8">
            <CmsTableOfContents items={toc} />
          </div>
        )}
        <div
          className="prose prose-slate mt-8 max-w-none"
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
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
