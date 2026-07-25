'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { JobStatus } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { formatJobLevel, formatSalary } from '@/lib/format';
import {
  deleteJob,
  listMyJobs,
  publishJob,
  updateJobStatus,
} from '@/lib/jobs';

const STATUS_LABEL: Record<JobStatus, string> = {
  [JobStatus.Draft]: 'Nháp',
  [JobStatus.Published]: 'Đang tuyển',
  [JobStatus.Paused]: 'Tạm dừng',
  [JobStatus.Closed]: 'Đã đóng',
};

function statusTone(status: JobStatus): 'green' | 'slate' | 'amber' | 'red' {
  if (status === JobStatus.Published) return 'green';
  if (status === JobStatus.Paused) return 'amber';
  if (status === JobStatus.Closed) return 'red';
  return 'slate';
}

export default function ManageJobsPage() {
  const queryClient = useQueryClient();
  const { data: jobs, isLoading, isError, error } = useQuery({
    queryKey: ['my-jobs'],
    queryFn: listMyJobs,
    retry: false,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['my-jobs'] });

  const publishMutation = useMutation({
    mutationFn: (id: string) => publishJob(id),
    onSuccess: invalidate,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: JobStatus }) =>
      updateJobStatus(
        id,
        status as
          | JobStatus.Published
          | JobStatus.Paused
          | JobStatus.Closed
          | JobStatus.Draft,
      ),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteJob(id),
    onSuccess: invalidate,
  });

  const busy =
    publishMutation.isPending || statusMutation.isPending || deleteMutation.isPending;

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tin tuyển dụng</h1>
          <p className="mt-1 text-slate-500">
            Thêm, sửa, tạm dừng hoặc xoá tin đăng — xem ứng viên ứng tuyển.
          </p>
        </div>
        <Link href="/jobs/new">
          <Button>
            <Plus className="h-4 w-4" /> Đăng tin mới
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
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/jobs/${job.id}/edit`}
                  className="font-semibold text-slate-900 hover:text-brand-600 hover:underline"
                >
                  {job.title}
                </Link>
                <Badge tone={statusTone(job.status)}>{STATUS_LABEL[job.status]}</Badge>
              </div>
              <p className="mt-0.5 text-sm text-slate-500">
                {job.code}
                {job.jobLevel ? ` · ${formatJobLevel(job.jobLevel)}` : ''} ·{' '}
                {job.location ?? 'Không rõ địa điểm'} ·{' '}
                {formatSalary(job.salaryMin, job.salaryMax)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/jobs/${job.id}/edit`}>
                <Button variant="outline" disabled={busy}>
                  <Pencil className="h-4 w-4" /> Sửa
                </Button>
              </Link>

              {job.status === JobStatus.Draft && (
                <Button
                  variant="outline"
                  onClick={() => publishMutation.mutate(job.id)}
                  disabled={busy}
                >
                  <Play className="h-4 w-4" /> Đăng công khai
                </Button>
              )}

              {job.status === JobStatus.Published && (
                <Button
                  variant="outline"
                  onClick={() =>
                    statusMutation.mutate({ id: job.id, status: JobStatus.Paused })
                  }
                  disabled={busy}
                >
                  <Pause className="h-4 w-4" /> Tạm dừng
                </Button>
              )}

              {job.status === JobStatus.Paused && (
                <Button
                  variant="outline"
                  onClick={() =>
                    statusMutation.mutate({ id: job.id, status: JobStatus.Published })
                  }
                  disabled={busy}
                >
                  <Play className="h-4 w-4" /> Mở lại
                </Button>
              )}

              {(job.status === JobStatus.Published || job.status === JobStatus.Paused) && (
                <Button
                  variant="outline"
                  onClick={() =>
                    statusMutation.mutate({ id: job.id, status: JobStatus.Closed })
                  }
                  disabled={busy}
                >
                  <XCircle className="h-4 w-4" /> Đóng
                </Button>
              )}

              <Link href={`/jobs/${job.id}/applicants`}>
                <Button variant="outline">
                  <Users className="h-4 w-4" /> Ứng viên
                </Button>
              </Link>

              <Button
                variant="ghost"
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      `Xoá tin «${job.title}»? Thao tác không hoàn tác từ danh sách.`,
                    )
                  ) {
                    deleteMutation.mutate(job.id);
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
