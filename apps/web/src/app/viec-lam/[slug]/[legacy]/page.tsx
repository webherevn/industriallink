import { jobPublicPath } from '@industriallink/contracts';
import { notFound, permanentRedirect } from 'next/navigation';
import { fetchPublicJob } from '@/lib/public-job-api';

/** URL cũ /viec-lam/{nganh}/{slug} → /viec-lam/{slug} */
export default async function LegacySiloJobRedirect({
  params,
}: {
  params: Promise<{ slug: string; legacy: string }>;
}) {
  const { slug, legacy } = await params;
  const job = (await fetchPublicJob(legacy)) ?? (await fetchPublicJob(slug));
  if (!job) notFound();
  permanentRedirect(jobPublicPath(job));
}
