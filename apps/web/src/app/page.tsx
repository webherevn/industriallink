import type { Metadata } from 'next';
import { resolveCmsAssetUrl } from '@/lib/cms-assets';
import { cmsRobotsMeta, formatCmsSeoTitle } from '@/lib/cms-seo';
import { isQueryVariant, parentCanonicalMetadata } from '@/lib/listing-seo';
import { fetchPublicCmsHomepage } from '@/lib/public-cms-api';
import { fetchPublishedJobs } from '@/lib/public-job-api';
import { siteUrl } from '@/lib/public-paths';
import { JobsListingClient } from './viec-lam/jobs-listing-client';

export const revalidate = 60;

const FALLBACK_TITLE = 'inlink — Kết nối nhân tài, dẫn lối công nghiệp';
const FALLBACK_DESC =
  'Tìm việc kỹ sư kinh doanh, kỹ thuật, M&E, tự động hóa. Kết nối nhân tài công nghiệp B2B trên inlink.';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const home = await fetchPublicCmsHomepage();
  const titleRaw = home?.seoTitle?.trim() || FALLBACK_TITLE;
  const title = formatCmsSeoTitle(titleRaw);
  const description = home?.seoDescription?.trim() || FALLBACK_DESC;
  const path = home?.canonicalPath?.trim() || '/';
  const canonical = path.startsWith('http') ? path : `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const ogImage = resolveCmsAssetUrl(home?.ogImageUrl);
  const ogTitle = home?.ogTitle?.trim() || home?.seoTitle?.trim() || FALLBACK_TITLE;
  const ogDescription =
    home?.ogDescription?.trim() || home?.seoDescription?.trim() || FALLBACK_DESC;

  if (isQueryVariant(sp)) {
    return parentCanonicalMetadata('/', sp, {
      title: { absolute: title },
      description,
    });
  }

  return {
    title: { absolute: title },
    description,
    robots: home ? cmsRobotsMeta(home) : undefined,
    alternates: { canonical },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: canonical,
      type: 'website',
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630 }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDescription,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

/** Tạm: trang chủ = giao diện việc làm. Thiết kế homepage riêng sẽ thay sau. */
export default async function HomePage() {
  const [jobs, home] = await Promise.all([
    fetchPublishedJobs(),
    fetchPublicCmsHomepage(),
  ]);
  return (
    <JobsListingClient
      initialJobs={jobs}
      heroHeading={home?.heading}
      heroHeadingAccent={home?.headingAccent}
      heroSubtitle={home?.subtitle}
    />
  );
}
