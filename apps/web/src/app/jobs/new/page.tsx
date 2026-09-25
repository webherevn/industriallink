'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { JobTrack } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui';
import { fetchMe } from '@/lib/auth';
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
        <span hidden data-il-build="jd-company-gate-v2">
          jd-company-gate-v2
        </span>
        <Link href="/company" className="mt-6 inline-block">
          <Button>Tới trang Công ty</Button>
        </Link>
      </div>
    </AppShell>
  );
}

export default function NewJobPage() {
  const [track, setTrack] = useState<JobTrack>(JobTrack.Sales);

  const {
    data: me,
    isLoading: meLoading,
    isPending: mePending,
    isError: meError,
    isSuccess: meOk,
  } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    retry: false,
    staleTime: 0,
  });

  const {
    data: company,
    isLoading: companyLoading,
    isPending: companyPending,
    isSuccess: companyOk,
  } = useQuery({
    queryKey: ['my-company', me?.id ?? 'anon'],
    queryFn: getMyCompany,
    enabled: Boolean(me?.id),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  if (meLoading || mePending || meError || !meOk || !me?.id) {
    return (
      <AppShell>
        <p className="py-16 text-center text-sm text-slate-500">
          {meError ? 'Vui lòng đăng nhập lại.' : 'Đang tải...'}
        </p>
      </AppShell>
    );
  }

  if (companyLoading || companyPending) {
    return (
      <AppShell>
        <p className="py-16 text-center text-sm text-slate-500">Đang tải...</p>
      </AppShell>
    );
  }

  // Chỉ mở form khi API trả công ty thành công — không dùng data cache kèm isError
  if (!companyOk || !company?.id) {
    return <CompanyRequiredGate />;
  }

  if (track === JobTrack.Technical) {
    return <JdTechnicalCreateFlow onSwitchTrack={setTrack} />;
  }
  return <JdSalesCreateFlow onSwitchTrack={setTrack} />;
}
