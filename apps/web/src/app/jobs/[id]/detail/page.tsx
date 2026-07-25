'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CalendarDays,
  ExternalLink,
  MapPin,
  Pencil,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ExperienceBand, JobStatus } from '@industriallink/contracts';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  EMPLOYMENT_LABEL,
  EXPERIENCE_LABEL,
  formatJobLevel,
  formatSalary,
} from '@/lib/format';
import { getJob } from '@/lib/jobs';

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

function splitLines(text: string | null | undefined): string[] {
  if (!text?.trim()) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function JobDetailManagePage() {
  const params = useParams<{ id: string }>();
  const jobId = params.id;

  const { data: job, isLoading, isError, error } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJob(jobId),
    retry: false,
  });

  if (isLoading) {
    return (
      <AppShell>
        <p className="text-slate-500">Đang tải chi tiết tin…</p>
      </AppShell>
    );
  }

  if (isError || !job) {
    return (
      <AppShell>
        <Card className="text-center">
          <p className="text-slate-600">
            {error instanceof ApiError ? error.message : 'Không tải được tin tuyển dụng.'}
          </p>
          <Link href="/jobs/manage">
            <Button className="mt-4" variant="outline">
              Quay lại danh sách
            </Button>
          </Link>
        </Card>
      </AppShell>
    );
  }

  const descriptionLines = splitLines(job.description);
  const requirementLines = splitLines(job.requirements);
  const benefitLines = splitLines(job.benefits);
  const isPublic = job.status === JobStatus.Published;

  return (
    <AppShell>
      <div className="mb-4">
        <Link
          href="/jobs/manage"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Tin tuyển dụng
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="brand-accent-dot" />
            <Badge tone={statusTone(job.status)}>{STATUS_LABEL[job.status]}</Badge>
            <span className="text-[12px] font-medium text-slate-400">{job.code}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem]">
            {job.title}
          </h1>
          <div className="brand-accent-bar mt-2" />
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
              <Building2 className="h-4 w-4 text-slate-400" />
              {job.companyName}
            </span>
            {job.department && (
              <>
                <span className="text-slate-300">·</span>
                <span>{job.department}</span>
              </>
            )}
            {job.industry && (
              <>
                <span className="text-slate-300">·</span>
                <span>{job.industry}</span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/jobs/${job.id}/edit`}>
            <Button variant="outline">
              <Pencil className="h-4 w-4" /> Sửa tin
            </Button>
          </Link>
          <Link href={`/jobs/${job.id}/applicants`}>
            <Button variant="outline">
              <Users className="h-4 w-4" /> Ứng viên
            </Button>
          </Link>
          {isPublic && (
            <Link href={`/jobs/${job.id}`} target="_blank">
              <Button>
                <ExternalLink className="h-4 w-4" /> Xem bản công khai
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InfoTile
          icon={<MapPin className="h-4 w-4" />}
          label="Địa điểm"
          value={job.location ?? 'Chưa cập nhật'}
        />
        <InfoTile
          icon={<Wallet className="h-4 w-4" />}
          label="Mức lương"
          value={formatSalary(job.salaryMin, job.salaryMax)}
        />
        <InfoTile
          icon={<Briefcase className="h-4 w-4" />}
          label="Cấp bậc / hình thức"
          value={[
            job.jobLevel ? formatJobLevel(job.jobLevel) : null,
            job.employmentType
              ? EMPLOYMENT_LABEL[job.employmentType] ?? job.employmentType
              : null,
          ]
            .filter(Boolean)
            .join(' · ') || '—'}
        />
        <InfoTile
          icon={<CalendarDays className="h-4 w-4" />}
          label="Hạn nộp / số lượng"
          value={`${formatDate(job.deadline)} · ${job.headcount ?? '—'} vị trí`}
        />
      </div>

      <div className="brand-panel-soft mt-4 px-4 py-3 text-sm text-slate-600 sm:px-5">
        <span className="font-medium text-slate-800">Kinh nghiệm:</span>{' '}
        {job.experienceBand
          ? EXPERIENCE_LABEL[job.experienceBand as ExperienceBand] ?? job.experienceBand
          : 'Không yêu cầu'}
        <span className="mx-2 text-slate-300">|</span>
        <span className="font-medium text-slate-800">Ngày tạo:</span> {formatDate(job.createdAt)}
      </div>

      {job.skills.length > 0 && (
        <section className="mt-6">
          <h2 className="text-[15px] font-semibold text-slate-900">Kỹ năng yêu cầu</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {job.skills.map((s) => (
              <Badge key={`${s.name}-${s.required}`} tone={s.required ? 'brand' : 'green'}>
                {s.name}
                {s.required ? ' · bắt buộc' : ''}
              </Badge>
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <ContentBlock
          title="Mô tả công việc"
          lines={descriptionLines}
          fallback={job.description}
          className="lg:col-span-2"
        />
        <div className="space-y-4">
          <ContentBlock title="Yêu cầu ứng viên" lines={requirementLines} fallback={job.requirements} />
          <ContentBlock title="Quyền lợi" lines={benefitLines} fallback={job.benefits} />
        </div>
      </div>
    </AppShell>
  );
}

function InfoTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="brand-panel p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-50 text-accent-600 ring-1 ring-accent-100">
        {icon}
      </div>
      <p className="mt-3 text-[12px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-[14px] font-semibold leading-snug text-slate-900">{value}</p>
    </div>
  );
}

function ContentBlock({
  title,
  lines,
  fallback,
  className,
}: {
  title: string;
  lines: string[];
  fallback: string | null | undefined;
  className?: string;
}) {
  const hasContent = lines.length > 0 || Boolean(fallback?.trim());
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ${className ?? ''}`}
    >
      <h2 className="text-[15px] font-semibold text-slate-900">{title}</h2>
      {!hasContent && <p className="mt-3 text-sm text-slate-400">Chưa cập nhật.</p>}
      {lines.length > 0 ? (
        <ul className="mt-3 space-y-2 text-[14px] leading-relaxed text-slate-700">
          {lines.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : (
        fallback?.trim() && (
          <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed text-slate-700">
            {fallback}
          </p>
        )
      )}
    </section>
  );
}
