import { redirect } from 'next/navigation';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const topup = typeof sp.topup === 'string' ? sp.topup : undefined;
  redirect(topup ? `/recruiter/billing/topup?topup=${encodeURIComponent(topup)}` : '/recruiter/billing/topup');
}
