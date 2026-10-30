'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { JobTrack } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui';
import { getMyCompany } from '@/lib/company';
import { jobViewToForm } from '@/lib/jd-sales-form';
import { jobViewToTechnicalForm } from '@/lib/jd-technical-form';
import { getJob } from '@/lib/jobs';
import { JdSalesCreateFlow } from './sales-create-flow';
import { JdTechnicalCreateFlow } from './technical-create-flow';

function trackFromJob(job: {
  jobTrack?: string | null;
  jobLevel?: string | null;
  salesCriteria?: unknown;
  technicalCriteria?: unknown;
}): JobTrack {
  if (job.jobTrack === JobTrack.Technical || job.jobLevel?.startsWith('technical.') || job.technicalCriteria) {
    return JobTrack.Technical;
  }
  if (job.jobTrack === JobTrack.Sales || job.jobLevel?.startsWith('sales.') || job.salesCriteria) {
    return JobTrack.Sales;
  }
  return JobTrack.Technical;
}

function openDeadline(value: string): string {
  if (!value.trim()) return '';
  const time = new Date(value).getTime();
  if (!Number.isFinite(time) || time < Date.now()) return '';
  return value;
}

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
  const searchParams = useSearchParams();
  const copyFrom = searchParams.get('from') ?? '';
  const [pickedTrack, setPickedTrack] = useState<JobTrack | null>(null);

  // Auth do RecruiterShell lo — chỉ kiểm tra hồ sơ công ty
  const {
    data: company,
    isLoading,
    isFetching,
    isSuccess,
    isFetched,
  } = useQuery({
    queryKey: ['my-company'],
    queryFn: getMyCompany,
    retry: false,
    staleTime: 30_000,
  });

  const copyQuery = useQuery({
    queryKey: ['job', copyFrom],
    queryFn: () => getJob(copyFrom),
    enabled: Boolean(copyFrom),
    retry: false,
  });

  if (isLoading || (isFetching && !isFetched) || (copyFrom && copyQuery.isLoading)) {
    return (
      <AppShell>
        <p className="py-16 text-center text-sm text-slate-500">Đang tải...</p>
      </AppShell>
    );
  }

  if (!isSuccess || !company?.id) {
    return <CompanyRequiredGate />;
  }

  const source = copyQuery.data;
  const sourceTrack = source ? trackFromJob(source) : null;
  const track = pickedTrack ?? sourceTrack ?? JobTrack.Sales;
  const copiedTitle = source?.title;

  if (track === JobTrack.Technical) {
    const initial =
      source && sourceTrack === JobTrack.Technical ? jobViewToTechnicalForm(source) : undefined;
    return (
      <JdTechnicalCreateFlow
        onSwitchTrack={setPickedTrack}
        initialForm={initial ? { ...initial, deadline: openDeadline(initial.deadline) } : undefined}
        copiedTitle={initial ? copiedTitle : undefined}
      />
    );
  }
  const initial = source && sourceTrack === JobTrack.Sales ? jobViewToForm(source) : undefined;
  return (
    <JdSalesCreateFlow
      onSwitchTrack={setPickedTrack}
      initialForm={initial ? { ...initial, deadline: openDeadline(initial.deadline) } : undefined}
      copiedTitle={initial ? copiedTitle : undefined}
    />
  );
}
