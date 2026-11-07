'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { JobTrack } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { JdSalesForm } from '@/components/jd-sales-form';
import { JdTechnicalForm } from '@/components/jd-technical-form';
import { Button } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  emptyJdSalesForm,
  formToCreateJobRequest,
  jobViewToForm,
  type JdSalesFormState,
} from '@/lib/jd-sales-form';
import {
  emptyJdTechnicalForm,
  formToCreateTechnicalJobRequest,
  jobViewToTechnicalForm,
  type JdTechnicalFormState,
} from '@/lib/jd-technical-form';
import { getJob, updateJob } from '@/lib/jobs';

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

export default function EditJobPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const { data: job, isLoading, error } = useQuery({
    queryKey: ['job', id],
    queryFn: () => getJob(id),
    enabled: Boolean(id),
    retry: false,
  });

  const [salesForm, setSalesForm] = useState<JdSalesFormState>(emptyJdSalesForm);
  const [techForm, setTechForm] = useState<JdTechnicalFormState>(emptyJdTechnicalForm);
  const [hydrated, setHydrated] = useState(false);

  const isSales = job ? trackFromJob(job) === JobTrack.Sales : false;

  useEffect(() => {
    if (!job || hydrated) return;
    setSalesForm(jobViewToForm(job));
    setTechForm(jobViewToTechnicalForm(job));
    setHydrated(true);
  }, [job, hydrated]);

  const saveMutation = useMutation({
    mutationFn: () => {
      if (isSales) {
        const { publish: _publish, ...payload } = formToCreateJobRequest(salesForm, false);
        return updateJob(id, payload);
      }
      const { publish: _publish, ...payload } = formToCreateTechnicalJobRequest(techForm, false);
      return updateJob(id, payload);
    },
    onSuccess: () => router.push('/jobs/manage'),
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-5 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/jobs/manage"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-600"
            >
              <ArrowLeft className="h-4 w-4" /> Quay lại danh sách
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Sửa tin tuyển dụng</h1>
            {job && (
              <p className="mt-1 text-sm text-slate-500">
                {job.code} · {job.title}
              </p>
            )}
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={
              saveMutation.isPending ||
              Boolean(job?.isSourcingActive) ||
              !hydrated ||
              (isSales
                ? salesForm.title.trim().length < 3 || !salesForm.jobLevel
                : techForm.title.trim().length < 3 || !techForm.jobLevel)
            }
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Lưu thay đổi
          </Button>
        </div>

        {isLoading && (
          <p className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải tin…
          </p>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">
            {error instanceof ApiError ? error.message : 'Không tải được tin tuyển dụng'}
          </div>
        )}

        {job?.isSourcingActive && (
          <div className="rounded-2xl border border-[#FFD0A3] bg-[#FFF8F1] p-5 text-sm text-[#072348] shadow-xs">
            <p className="text-base font-bold text-[#072348]">
              Tin tuyển dụng này đang hoạt động săn tin
            </p>
            <p className="mt-1 text-slate-600">
              Tin đăng đã chuyển sang chế độ <strong>Săn nhân sự</strong> sẽ được khóa cố định tại mục Tin tuyển dụng để đảm bảo tính đồng nhất của phễu ứng viên. Để điều chỉnh tiêu chí săn, vui lòng thao tác tại mục <strong>Săn nhân sự</strong>.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/recruiter/sourcing"
                className="inline-flex items-center gap-2 rounded-xl bg-[#072348] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#0b3162]"
              >
                Mở mục Săn nhân sự →
              </Link>
              <Link
                href="/jobs/manage"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Quay lại Tin tuyển dụng
              </Link>
            </div>
          </div>
        )}

        {hydrated && !job?.isSourcingActive && isSales && (
          <div className="space-y-4 pb-10">
            {saveMutation.isError && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {saveMutation.error instanceof ApiError
                  ? saveMutation.error.message
                  : 'Không lưu được thay đổi'}
              </p>
            )}
            <JdSalesForm
              form={salesForm}
              showProgress
              lockPosition
              onChange={(patch) => setSalesForm((prev) => ({ ...prev, ...patch }))}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Link href="/jobs/manage">
                <Button variant="outline">Huỷ</Button>
              </Link>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={
                  saveMutation.isPending ||
                  salesForm.title.trim().length < 3 ||
                  !salesForm.jobLevel
                }
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Lưu thay đổi
              </Button>
            </div>
          </div>
        )}

        {hydrated && !job?.isSourcingActive && !isSales && (
          <div className="space-y-4 pb-10">
            {saveMutation.isError && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {saveMutation.error instanceof ApiError
                  ? saveMutation.error.message
                  : 'Không lưu được thay đổi'}
              </p>
            )}
            <JdTechnicalForm
              form={techForm}
              showProgress
              lockPosition
              onChange={(patch) => setTechForm((prev) => ({ ...prev, ...patch }))}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Link href="/jobs/manage">
                <Button variant="outline">Huỷ</Button>
              </Link>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={
                  saveMutation.isPending || techForm.title.trim().length < 3 || !techForm.jobLevel
                }
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Lưu thay đổi
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
