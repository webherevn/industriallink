'use client';

import { useParams } from 'next/navigation';
import { AdminCompanyDetailPage } from '@/components/admin-company-detail';

export default function AdminCompanyDetailRoute() {
  const params = useParams<{ id: string }>();
  return <AdminCompanyDetailPage companyId={params.id} />;
}
