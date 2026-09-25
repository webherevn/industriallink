import { companyPublicPath } from '@industriallink/contracts';
import { notFound, permanentRedirect } from 'next/navigation';
import { fetchPublicCompany } from '@/lib/public-job-api';

export default async function LegacyCompanyRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await fetchPublicCompany(id);
  if (!company) notFound();
  permanentRedirect(companyPublicPath(company));
}
