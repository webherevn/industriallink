'use client';

import type { CmsTrustGrade, CmsTrustReport } from '@industriallink/contracts';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button } from '@/components/ui';
import { fetchCmsTrust } from '@/lib/admin-cms';

const GRADE_LABEL: Record<CmsTrustGrade, string> = {
  great: 'Rất tốt',
  good: 'Tốt',
  ok: 'Tạm',
  bad: 'Yếu',
};

function gradeClass(grade: CmsTrustGrade): string {
  if (grade === 'great' || grade === 'good') return 'text-emerald-700';
  if (grade === 'ok') return 'text-amber-800';
  return 'text-red-700';
}

export default function AdminSeoTrustPage() {
  const { data, isLoading, isFetching, isError, error, refetch } = useQuery({
    queryKey: ['admin-cms-trust'],
    queryFn: fetchCmsTrust,
    refetchOnWindowFocus: true,
  });
  const [filter, setFilter] = useState<'all' | 'salary' | 'deadline' | 'expired'>('all');
  const jobs = useMemo(() => {
    if (!data) return [];
    if (filter === 'all') return data.jobs.items;
    return data.jobs.items.filter((item) => item.issues.some((issue) => issue.code === filter));
  }, [data, filter]);

  return (
    <AdminShell>
      <div className="admin-dash space-y-6">
        <div className="admin-dash-rise flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">Schema & E-E-A-T</p>
            <h1 className="cms-page-title mt-1.5">E-E-A-T & schema</h1>
            <div className="brand-accent-bar mt-2" />
            <p className="cms-page-subtitle mt-2">
              Điểm hồ sơ tác giả và các tin published thiếu trường JobPosting mà Google dùng để hiển thị việc làm.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/seo" className="inline-flex h-10 items-center rounded-xl bg-white px-3 text-sm font-semibold text-[#072348] ring-1 ring-slate-200 transition hover:bg-[#FFF8F1] hover:ring-[#FFD0A3]">
              SEO overview
            </Link>
            <Button type="button" variant="ghost" className="gap-1.5 shadow-sm" onClick={() => void refetch()} disabled={isFetching}>
              <RefreshCw className={clsx('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              Làm mới
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="admin-dash-skel h-40" />
        ) : isError || !data ? (
          <p className="rounded-[1.15rem] border border-dashed border-red-200 bg-red-50 px-4 py-8 text-sm text-red-700">
            {error instanceof Error ? error.message : 'Không tải được báo cáo E-E-A-T.'}
          </p>
        ) : (
          <>
            <AuthorPanel data={data} />
            <JobPanel data={data} filter={filter} onFilter={setFilter} jobs={jobs} />
          </>
        )}
      </div>
    </AdminShell>
  );
}

function AuthorPanel({ data }: { data: CmsTrustReport }) {
  return (
    <section className="admin-dash-card p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Hồ sơ tác giả</h2>
          <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
            Chấm theo chức danh, bio từ 80 ký tự, ảnh, worksFor, trang public, LinkedIn và bài đã xuất bản.
          </p>
        </div>
        <p className="text-2xl font-bold tabular-nums text-[#072348]">
          {data.authors.averageScore}
          <span className="text-base font-semibold text-slate-400">/100</span>
        </p>
      </div>
      {data.authors.items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Chưa có hồ sơ tác giả.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {data.authors.items.map((item) => (
            <li key={item.userId} className="py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={clsx('text-lg font-bold tabular-nums', gradeClass(item.grade))}>{item.score}</span>
                <Link href={item.editPath} className="font-semibold text-[#072348] hover:text-accent-600">
                  {item.displayName}
                </Link>
                <span className="text-xs text-slate-500">
                  {GRADE_LABEL[item.grade]} · {item.postCount} bài
                </span>
                {item.publicPath ? (
                  <a href={item.publicPath} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#E8872A]">
                    Xem trang
                  </a>
                ) : null}
              </div>
              {item.missing.length === 0 ? (
                <p className="mt-1 text-xs text-emerald-700">Đủ tín hiệu E-E-A-T đang chấm.</p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Thiếu: {item.missing.join(' · ')}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function JobPanel({
  data,
  filter,
  onFilter,
  jobs,
}: {
  data: CmsTrustReport;
  filter: 'all' | 'salary' | 'deadline' | 'expired';
  onFilter: (value: 'all' | 'salary' | 'deadline' | 'expired') => void;
  jobs: CmsTrustReport['jobs']['items'];
}) {
  return (
    <section className="admin-dash-card p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">JobPosting</h2>
          <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
            Tin published còn thiếu hạn nộp, lương, địa điểm hoặc loại hình. Không có hạn nộp thì validThrough đang tự cộng 30 ngày. Hạn đã qua là lỗi nặng.
          </p>
        </div>
        <div className="flex rounded-xl bg-[#f8fafc] p-1 ring-1 ring-slate-200">
          {(
            [
              ['all', 'Tất cả'],
              ['salary', 'Thiếu lương'],
              ['deadline', 'Thiếu hạn'],
              ['expired', 'Hết hạn'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={clsx('rounded-lg px-2.5 py-1 text-xs font-semibold', filter === id ? 'bg-[#072348] text-white' : 'text-slate-500')}
              onClick={() => onFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ['Đã quét', data.jobs.scanned],
          ['Đạt', data.jobs.valid],
          ['Cần sửa', data.jobs.withIssues],
          ['Thiếu lương', data.jobs.missingSalary],
          ['Hết hạn', data.jobs.expired],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl bg-[#f8fafc] px-4 py-3 ring-1 ring-slate-100">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-[#072348]">{value}</p>
          </div>
        ))}
      </div>
      {jobs.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Không có tin khớp bộ lọc.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-100">
          {jobs.map((item) => (
            <li key={item.id} className="py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <Link href={item.editPath} className="font-semibold text-[#072348] hover:text-accent-600">
                  {item.title}
                </Link>
                <span className="text-xs text-slate-500">{item.companyName}</span>
                <a href={item.publicPath} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#E8872A]">
                  Xem tin
                </a>
              </div>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {item.issues.map((issue) => (
                  <li
                    key={issue.code}
                    className={clsx(
                      'rounded px-1.5 py-0.5 text-[10px] font-bold',
                      issue.severity === 'critical' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800',
                    )}
                  >
                    {issue.label}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
