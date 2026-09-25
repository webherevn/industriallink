import {
  buildJobListJsonLd,
  jobListingPath,
} from '@industriallink/contracts';
import type { Metadata } from 'next';
import { isQueryVariant, parentCanonicalMetadata } from '@/lib/listing-seo';
import { fetchPublishedJobs } from '@/lib/public-job-api';
import { siteUrl } from '@/lib/public-paths';
import { JobsListingClient } from './jobs-listing-client';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  return parentCanonicalMetadata(jobListingPath(), sp, {
    title: 'Việc làm công nghiệp B2B | inlink',
    description:
      'Tìm việc kỹ sư kinh doanh, kỹ thuật, M&E, tự động hóa trên inlink.',
  });
}

export default async function ViecLamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const jobs = await fetchPublishedJobs();
  const listLd = isQueryVariant(sp) ? null : buildJobListJsonLd(jobs, siteUrl());

  return (
    <>
      {listLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(listLd) }}
        />
      ) : null}
      <JobsListingClient initialJobs={jobs} />
    </>
  );
}
