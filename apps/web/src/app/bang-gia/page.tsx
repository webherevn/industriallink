/**
 * Trang bảng giá marketing (đủ section như local).
 * Host tuyendung.inlink.vn chỉ đổi canonical/SEO — không rút gọn layout.
 *
 * Dữ liệu: /api/v1/billing/public-config (public, ISR 5 phút).
 */
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { DEFAULT_BILLING_PAGE_CONTENT } from '@industriallink/contracts';
import { PricingClient } from '@/components/pricing-client';
import { fetchPublicBillingConfig } from '@/lib/admin-billing';
import { normalizePricingConfig, normalizePricingPage, pricingSoftwareApplicationJsonLd } from '@/lib/pricing-catalog';
import { resolveCmsAssetUrl } from '@/lib/cms-assets';
import {
  isRecruiterHostname,
  recruiterSiteUrl,
  publicSiteUrl,
} from '@/lib/hosts';

export const revalidate = 300; // 5 phút

function buildCanonical(hostname: string): string {
  const base = isRecruiterHostname(hostname) ? recruiterSiteUrl() : publicSiteUrl();
  return `${base}/bang-gia`;
}

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  const hostname = h.get('host') ?? '';
  const onRecruiter = isRecruiterHostname(hostname);
  const canonical = buildCanonical(hostname);

  let page = DEFAULT_BILLING_PAGE_CONTENT;
  try {
    const config = await fetchPublicBillingConfig();
    if (config.pageContent) page = normalizePricingPage(config.pageContent);
  } catch {
    // fallback defaults
  }

  const title = onRecruiter ? page.seoTitleRecruiter : page.seoTitle;
  const description = onRecruiter ? page.seoDescriptionRecruiter : page.seoDescription;
  const ogTitle = page.ogTitle?.trim() || title;
  const ogDescription = page.ogDescription?.trim() || description;
  const ogImage = resolveCmsAssetUrl(page.ogImageUrl) ?? '/og-pricing.png';

  return {
    title,
    description,
    keywords: page.focusKeyword ? [page.focusKeyword] : undefined,
    alternates: { canonical },
    robots: onRecruiter
      ? {
          index: page.robotsIndex,
          follow: page.robotsFollow,
          'max-image-preview': 'large',
        }
      : { index: false, follow: page.robotsFollow, nocache: true },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: 'website',
      url: canonical,
      siteName: 'inlink',
      locale: 'vi_VN',
      images: [{ url: ogImage, width: 1200, height: 630, alt: page.ogImageAlt || 'Bảng giá inlink' }],
    },
    twitter: { card: 'summary_large_image', title: ogTitle, description: ogDescription },
  };
}

export default async function PricingPage() {
  const h = await headers();
  const hostname = h.get('host') ?? '';
  const onRecruiter = isRecruiterHostname(hostname);

  let config: Awaited<ReturnType<typeof fetchPublicBillingConfig>> | null = null;
  try {
    const loaded = await fetchPublicBillingConfig();
    config = normalizePricingConfig(loaded);
  } catch {
    // Render skeleton nếu API lỗi — không fail cả trang
  }

  const canonical = buildCanonical(hostname);
  const page = normalizePricingPage(config?.pageContent ?? DEFAULT_BILLING_PAGE_CONTENT);
  const salesMailto = `mailto:${page.contactEmail}`;

  const softwareSchema = config
    ? pricingSoftwareApplicationJsonLd(config, canonical, salesMailto)
    : null;

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faqItems.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: onRecruiter ? recruiterSiteUrl() : publicSiteUrl() },
      { '@type': 'ListItem', position: 2, name: 'Bảng giá', item: canonical },
    ],
  };

  const jsonLd = [
    ...(softwareSchema ? [softwareSchema] : []),
    faqSchema,
    breadcrumbSchema,
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PricingClient config={config} context="public" />
    </>
  );
}
