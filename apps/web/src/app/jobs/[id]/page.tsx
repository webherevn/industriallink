'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CheckCircle2, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { JobStatus } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card, Textarea } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { EMPLOYMENT_LABEL, formatJobLevel, formatSalary } from '@/lib/format';
import { applyToJob, getJob } from '@/lib/jobs';

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = params.id;
  const queryClient = useQueryClient();
  const [coverLetter, setCoverLetter] = useState('');

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJob(jobId),
    retry: false,
  });

  const applyMutation = useMutation({
    mutationFn: () => applyToJob(jobId, { coverLetter: coverLetter || undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['job', jobId] }),
  });

  if (isLoading) {
    return (
      <AppShell>
        <p className="text-slate-500">Đang tải...</p>
      </AppShell>
    );
  }
  if (!job) {
    return (
      <AppShell>
        <p className="text-slate-500">Không tìm thấy tin tuyển dụng.</p>
      </AppShell>
    );
  }

  const applied = job.hasApplied || applyMutation.isSuccess;

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h1 className="text-2xl font-bold text-slate-900">{job.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <Link
              href={`/companies/${job.companyId}`}
              className="inline-flex items-center gap-1 font-medium text-slate-700 transition hover:text-brand-600"
            >
              <Building2 className="h-4 w-4" /> {job.companyName}
            </Link>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-4 w-4" /> {job.location ?? 'Linh hoạt'}
            </span>
            {job.employmentType && <Badge tone="slate">{EMPLOYMENT_LABEL[job.employmentType]}</Badge>}
            {job.jobLevel && <Badge tone="brand">{formatJobLevel(job.jobLevel)}</Badge>}
          </div>

          <Card className="mt-6">
            <h2 className="font-semibold text-slate-900">Mô tả công việc</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{job.description}</p>
            {job.requirements && (
              <>
                <h2 className="mt-5 font-semibold text-slate-900">Yêu cầu</h2>
                <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                  {job.requirements}
                </p>
              </>
            )}
            {job.benefits && (
              <>
                <h2 className="mt-5 font-semibold text-slate-900">Quyền lợi & phúc lợi</h2>
                <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{job.benefits}</p>
              </>
            )}
            {job.skills.length > 0 && (
              <>
                <h2 className="mt-5 font-semibold text-slate-900">Kỹ năng</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {job.skills.map((s) => (
                    <Badge key={s.name}>{s.name}</Badge>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>

        <div>
          <Card>
            <p className="text-xs uppercase tracking-wide text-slate-400">Mức lương</p>
            <p className="mt-1 text-xl font-bold text-brand-600">
              {formatSalary(job.salaryMin, job.salaryMax)}
            </p>

            {job.status !== JobStatus.Published ? (
              <p className="mt-4 text-sm text-slate-400">Tin này chưa mở nhận hồ sơ.</p>
            ) : applied ? (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
                <CheckCircle2 className="h-5 w-5" /> Bạn đã ứng tuyển vị trí này.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <Textarea
                  rows={4}
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  placeholder="Thư giới thiệu (không bắt buộc)..."
                />
                {applyMutation.isError && (
                  <p className="text-sm text-red-600">
                    {applyMutation.error instanceof ApiError
                      ? applyMutation.error.message
                      : 'Có lỗi xảy ra'}
                  </p>
                )}
                <Button
                  className="w-full"
                  onClick={() => applyMutation.mutate()}
                  disabled={applyMutation.isPending}
                >
                  {applyMutation.isPending ? 'Đang gửi...' : 'Ứng tuyển ngay'}
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
