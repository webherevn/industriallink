'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { JobTrack } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { getMyCompany } from '@/lib/company';
import { JdSalesCreateFlow } from './sales-create-flow';
import { JdTechnicalCreateFlow } from './technical-create-flow';

function CompanyRequiredGate() {
  return (
    <AppShell>
      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
        <Building2 className="mx-auto h-12 w-12 text-brand-500" />
        <h1 className="mt-4 text-xl font-bold text-slate-900">Chưa có hồ sơ công ty</h1>
        <p className="mt-2 text-sm text-slate-600">Bạn cần tạo hồ sơ công ty trước.</p>
        <Link href="/company" className="mt-6 inline-block">
          <Button>Tới trang Công ty</Button>
        </Link>
      </div>
    </AppShell>
  );
}

export default function NewJobPage() {
  const [track, setTrack] = useState<JobTrack>(JobTrack.Sales);

  const { data: company, isLoading, isError, error } = useQuery({
    queryKey: ['my-company'],
    queryFn: getMyCompany,
    retry: false,
  });

  if (isLoading) {
    return (
      <AppShell>
        <p className="py-16 text-center text-sm text-slate-500">Đang tải...</p>
      </AppShell>
    );
  }

  if (isError) {
    const needCompany =
      error instanceof ApiError && (error.status === 404 || error.status === 403);
    if (needCompany) return <CompanyRequiredGate />;
    return (
      <AppShell>
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
          <p className="text-sm text-slate-600">
            {error instanceof ApiError ? error.message : 'Không tải được thông tin công ty.'}
          </p>
          <Link href="/company" className="mt-6 inline-block">
            <Button variant="outline">Tới trang Công ty</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  if (!company) return <CompanyRequiredGate />;

  if (track === JobTrack.Technical) {
    return <JdTechnicalCreateFlow onSwitchTrack={setTrack} />;
  }
  return <JdSalesCreateFlow onSwitchTrack={setTrack} />;
}
