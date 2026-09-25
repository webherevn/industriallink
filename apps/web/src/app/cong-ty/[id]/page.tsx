import { companyPublicPath } from '@industriallink/contracts';
import type { Metadata } from 'next';
import { fetchPublicCompany } from '@/lib/public-job-api';
import { INDEX_ROBOTS } from '@/lib/seo-robots';
import CompanyPublicPage from './company-profile-client';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const company = await fetchPublicCompany(id);
  const canonical = company ? companyPublicPath(company) : `/cong-ty/${id}`;
  return {
    title: company ? `${company.name} | inlink` : 'Thông tin công ty | inlink',
    description: 'Hồ sơ doanh nghiệp, việc làm đang tuyển và văn hóa công ty trên inlink.',
    robots: INDEX_ROBOTS,
    alternates: { canonical },
  };
}

export default CompanyPublicPage;
