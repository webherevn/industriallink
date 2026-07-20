'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Briefcase, Plus, Users } from 'lucide-react';
import Link from 'next/link';
import { JobStatus } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { formatJobLevel, formatSalary } from '@/lib/format';
import { listMyJobs, publishJob } from '@/lib/jobs';

const STATUS_LABEL: Record<JobStatus, string> = {
  [JobStatus.Draft]: 'Nháp',
  [JobStatus.Published]: 'Đang tuyển',
  [JobStatus.Paused]: 'Tạm dừng',
  [JobStatus.Closed]: 'Đã đóng',
};

export default function ManageJobsPage() {
  const queryClient = useQueryClient();
  const { data: jobs, isLoading, isError, error } = useQuery({
    queryKey: ['my-jobs'],
    queryFn: listMyJobs,
    retry: false,
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => publishJob(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-jobs'] }),
  });

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tin tuyển dụng</h1>
          <p className="mt-1 text-slate-500">Quản lý tin đăng và xem ứng viên ứng tuyển.</p>
        </div>
        <Link href="/jobs/new">
          <Button>
            <Plus className="h-4 w-4" /> Đăng tin
          </Button>
        </Link>
      </div>

      {isLoading && <p className="mt-6 text-slate-500">Đang tải...</p>}

      {isError && (
        <Card className="mt-6 text-center">
          <p className="text-slate-600">
            {error instanceof ApiError && error.status === 403
              ? 'Bạn cần tạo hồ sơ công ty trước.'
              : 'Không tải được danh sách tin.'}
          </p>
          <Link href="/company">
            <Button className="mt-4" variant="outline">
              Tới trang Công ty
            </Button>
          </Link>
        </Card>
      )}

      {jobs && jobs.length === 0 && (
        <Card className="mt-6 text-center">
          <Briefcase className="mx-auto h-10 w-10 text-brand-500" />
          <p className="mt-3 text-slate-600">Chưa có tin tuyển dụng nào.</p>
          <Link href="/jobs/new">
            <Button className="mt-4">Đăng tin đầu tiên</Button>
          </Link>
        </Card>
      )}

      <div className="mt-6 space-y-3">
        {jobs?.map((job) => (
          <Card key={job.id} className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-slate-900">{job.title}</p>
                <Badge tone={job.status === JobStatus.Published ? 'green' : 'slate'}>
                  {STATUS_LABEL[job.status]}
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">
                {job.code}
                {job.jobLevel ? ` · ${formatJobLevel(job.jobLevel)}` : ''} ·{' '}
                {job.location ?? 'Không rõ địa điểm'} · {formatSalary(job.salaryMin, job.salaryMax)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {job.status === JobStatus.Draft && (
                <Button
                  variant="outline"
                  onClick={() => publishMutation.mutate(job.id)}
                  disabled={publishMutation.isPending}
                >
                  Đăng công khai
                </Button>
              )}
              <Link href={`/jobs/${job.id}/applicants`}>
                <Button variant="outline">
                  <Users className="h-4 w-4" /> Ứng viên
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
