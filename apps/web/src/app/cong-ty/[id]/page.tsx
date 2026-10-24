import { companyPublicPath } from '@industriallink/contracts';
import type { Metadata } from 'next';
import { fetchPublicCompany } from '@/lib/public-job-api';
import { apiPublicBase, siteUrl } from '@/lib/public-paths';
import { INDEX_ROBOTS } from '@/lib/seo-robots';
import CompanyPublicPage from './company-profile-client';

function plain(value?: string | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function mediaUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${apiPublicBase()}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const company = await fetchPublicCompany(id);
  const canonical = company ? companyPublicPath(company) : `/cong-ty/${id}`;
  const name = company?.name ?? 'Thông tin công ty';
  const about = plain(company?.description);
  const description = about
    ? about.slice(0, 160)
    : `${name} đang tuyển dụng trên inlink. Xem việc làm, văn hóa và thông tin doanh nghiệp.`;
  const image = mediaUrl(company?.brand.bannerUrl) ?? mediaUrl(company?.brand.logoUrl);
  return {
    title: company ? `${company.name} tuyển dụng` : 'Thông tin công ty',
    description,
    robots: INDEX_ROBOTS,
    alternates: { canonical },
    openGraph: {
      title: `${name} tuyển dụng`,
      description,
      url: canonical,
      type: 'website',
      images: image ? [{ url: image, alt: name }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: `${name} tuyển dụng`,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const company = await fetchPublicCompany(id);
  const origin = siteUrl();
  const path = company ? companyPublicPath(company) : `/cong-ty/${id}`;
  const url = `${origin}${path}`;
  const name = company?.name ?? 'Công ty';
  const logo = mediaUrl(company?.brand.logoUrl);
  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name,
      url,
      description: plain(company?.description) || undefined,
      logo,
      email: company?.brand.email || undefined,
      telephone: company?.brand.phone || undefined,
      sameAs: [company?.brand.facebookUrl, company?.brand.linkedinUrl, company?.brand.youtubeUrl, company?.website]
        .filter((item): item is string => Boolean(item && /^https?:\/\//i.test(item))),
      address: company?.address
        ? { '@type': 'PostalAddress', streetAddress: company.address, addressCountry: 'VN' }
        : undefined,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: origin },
        { '@type': 'ListItem', position: 2, name: 'Công ty', item: `${origin}/viec-lam` },
        { '@type': 'ListItem', position: 3, name, item: url },
      ],
    },
  ];

  return (
    <>
      {schemas.map((schema, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <CompanyPublicPage />
    </>
  );
}
