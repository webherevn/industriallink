'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { BarChart3, Building2, Lock, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import type { AdminReportsView } from '@industriallink/contracts';
import { AdminShell } from '@/components/admin-shell';
import { Card } from '@/components/ui';
import { fetchAdminReports } from '@/lib/admin-reports';

function pct(part: number, whole: number): string {
  if (!whole) return '0%';
  return `${Math.round((part / whole) * 100)}%`;
}

function dayLabel(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function AdminReportsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-reports'],
    queryFn: fetchAdminReports,
    refetchInterval: 60_000,
  });

  return (
    <AdminShell>
      <div>
        <h1 className="cms-page-title flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-brand-600" />
          Báo cáo nền tảng
        </h1>
        <p className="cms-page-subtitle">
          KPI vận hành tuyển dụng: hàng đợi kiểm duyệt, tỷ lệ duyệt/từ chối, công ty, tài khoản
          khoá, tin đăng theo ngày.
        </p>
      </div>

      {isLoading ? (
        <p className="mt-6 text-sm text-slate-500">Đang tổng hợp số liệu…</p>
      ) : isError || !data ? (
        <Card className="mt-6 border-rose-200 bg-rose-50 py-8 text-center text-sm text-rose-700">
          Không tải được báo cáo.
        </Card>
      ) : (
        <ReportsBody data={data} />
      )}
    </AdminShell>
  );
}

function ReportsBody({ data }: { data: AdminReportsView }) {
  const maxDay = Math.max(1, ...data.jobs.byDay.map((d) => d.count));
  const decided = data.moderation.decided;

  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          href="/admin/moderation"
          icon={ShieldCheck}
          label="Độ sâu hàng đợi"
          value={data.queue.depth}
          hint={`${data.queue.needsManualReview} cần duyệt tay · ${data.queue.pending} đang chờ AI`}
          tone={data.queue.needsManualReview > 0 ? 'amber' : 'slate'}
        />
        <Kpi
          href="/admin/companies"
          icon={Building2}
          label="Công ty"
          value={data.companies.total}
          hint={`${data.companies.active} hoạt động · ${data.companies.suspended} treo · ${data.companies.banned} cấm`}
        />
        <Kpi
          href="/admin/users"
          icon={Lock}
          label="User đã khoá"
          value={data.users.locked}
          hint={`${data.users.total} tài khoản`}
          tone={data.users.locked > 0 ? 'rose' : 'slate'}
        />
        <Kpi
          href="/admin/jobs"
          icon={BarChart3}
          label="Tin đăng hôm nay"
          value={data.jobs.publishedToday}
          hint={`${data.jobs.publishedLive} đang live · ${data.jobs.publishedLast7Days} trong 7 ngày`}
          tone="emerald"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-slate-800">Tỷ lệ duyệt / từ chối</h2>
          <p className="mt-1 text-xs text-slate-500">
            Trên {decided} tin đã có kết quả (AI + duyệt tay). Không tính nháp và tin đang chờ.
          </p>
          {decided === 0 ? (
            <p className="mt-6 text-sm text-slate-500">Chưa có tin nào được quyết.</p>
          ) : (
            <>
              <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="bg-emerald-500"
                  style={{ width: pct(data.moderation.approved, decided) }}
                />
                <div
                  className="bg-rose-500"
                  style={{ width: pct(data.moderation.rejected, decided) }}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-2xl font-bold text-emerald-700">
                    {data.moderation.approvalRate ?? 0}%
                  </p>
                  <p className="text-slate-500">Duyệt · {data.moderation.approved}</p>
                  <p className="text-[11px] text-slate-400">
                    AI {data.moderation.approvedAuto} · tay {data.moderation.approvedManual}
                  </p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-rose-700">
                    {data.moderation.rejectionRate ?? 0}%
                  </p>
                  <p className="text-slate-500">Từ chối · {data.moderation.rejected}</p>
                  <p className="text-[11px] text-slate-400">
                    AI {data.moderation.rejectedAuto} · tay {data.moderation.rejectedManual}
                  </p>
                </div>
              </div>
            </>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-800">Tin được đăng — 14 ngày</h2>
          <p className="mt-1 text-xs text-slate-500">Theo ngày xuất bản (giờ Việt Nam), kể cả tin sau đó bị ẩn/đóng.</p>
          <div className="mt-4 flex h-40 items-end gap-1">
            {data.jobs.byDay.map((d) => (
              <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-slate-500">{d.count || ''}</span>
                <div
                  className="w-full rounded-t bg-brand-600"
                  style={{ height: `${Math.max(d.count ? 8 : 2, (d.count / maxDay) * 120)}px` }}
                  title={`${dayLabel(d.date)}: ${d.count}`}
                />
                <span className="text-[9px] text-slate-400">{dayLabel(d.date)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <p className="text-xs text-slate-400">
        Cập nhật {new Date(data.generatedAt).toLocaleString('vi-VN')} · tự làm mới mỗi phút.
      </p>
    </div>
  );
}

function Kpi({
  href,
  icon: Icon,
  label,
  value,
  hint,
  tone = 'slate',
}: {
  href: string;
  icon: typeof BarChart3;
  label: string;
  value: number;
  hint: string;
  tone?: 'slate' | 'amber' | 'rose' | 'emerald';
}) {
  const ring = {
    slate: 'ring-slate-200',
    amber: 'ring-amber-200 bg-amber-50/40',
    rose: 'ring-rose-200 bg-rose-50/40',
    emerald: 'ring-emerald-200 bg-emerald-50/40',
  }[tone];
  return (
    <Link href={href}>
      <Card className={clsx('h-full transition hover:shadow-md', ring)}>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </div>
        <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      </Card>
    </Link>
  );
}
