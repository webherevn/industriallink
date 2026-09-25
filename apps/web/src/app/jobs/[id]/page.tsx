import { jobPublicPath } from '@industriallink/contracts';
import { notFound, permanentRedirect } from 'next/navigation';
import { fetchPublicJob } from '@/lib/public-job-api';

export default async function LegacyJobRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await fetchPublicJob(id);
  if (!job) notFound();
  permanentRedirect(jobPublicPath(job));
}
