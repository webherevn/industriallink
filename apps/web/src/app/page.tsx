import type { Metadata } from 'next';
import { parentCanonicalMetadata } from '@/lib/listing-seo';
import { fetchPublishedJobs } from '@/lib/public-job-api';
import { JobsListingClient } from './viec-lam/jobs-listing-client';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  return parentCanonicalMetadata('/', sp, {
    title: 'inlink — Kết nối nhân tài, dẫn lối công nghiệp',
    description:
      'Tìm việc kỹ sư kinh doanh, kỹ thuật, M&E, tự động hóa. Kết nối nhân tài công nghiệp B2B trên inlink.',
  });
}

/** Tạm: trang chủ = giao diện việc làm. Thiết kế homepage riêng sẽ thay sau. */
export default async function HomePage() {
  const jobs = await fetchPublishedJobs();
  return <JobsListingClient initialJobs={jobs} />;
}
