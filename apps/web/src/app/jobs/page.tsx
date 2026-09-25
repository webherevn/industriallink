import { jobListingPath } from '@industriallink/contracts';
import { redirect } from 'next/navigation';

export default async function JobsAliasRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw) qs.set(key, raw);
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  redirect(`${jobListingPath()}${suffix}`);
}
