import type { Metadata } from 'next';
import { CrmDocs } from '@/components/crm/crm-docs';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Tài liệu · CRM' };

export default function CrmDocsPage() {
  return <CrmDocs />;
}
