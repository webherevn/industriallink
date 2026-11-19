'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  BadgeCheck,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  FileBarChart,
  Link2,
  ListChecks,
  Package,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import type {
  RecruiterJobPackageStatus,
  RecruiterJobPackageView,
} from '@industriallink/contracts';
import { formatVndAmount } from '@/lib/format';
import {
  fetchRecruiterEntitlements,
  fetchRecruiterJobPackages,
} from '@/lib/recruiter-billing';
import { JobPackageApplyModal } from '@/components/job-package-apply-modal';

const PACKAGE_STATUS_META: Record<
  RecruiterJobPackageStatus,
  { label: string; className: string }
> = {
  active: {
    label: 'Đang sử dụng',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  unused: {
    label: 'Chờ kích hoạt',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  expired: {
    label: 'Đã hết hạn',
    className: 'bg-slate-100 text-slate-500 border-slate-200',
  },
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

/** Số ngày còn lại để kích hoạt gói UNUSED (null = không giới hạn / không còn hạn). */
function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / 86_400_000);
}

/**
 * Phần 1 — "Hiển thị tài nguyên tin đăng".
 *
 * Số liệu lấy từ gói tin đăng multi-active:
 * tổng gói đã mua, gói đang chạy, gói chờ kích hoạt, lượt tin còn lại, ngày còn lại.
 */
export function JobPostingResourcePanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['recruiter-job-packages'],
    queryFn: fetchRecruiterJobPackages,
    retry: 1,
  });

  const metrics = buildMetrics(data?.summary, data?.items);

  return (
    <section className="brand-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#FFF8F1] text-[#E8872A]">
            <Sparkles className="h-4 w-4" />
          </span>
          <h2 className="text-[15px] font-bold text-[#072348]">Hiển thị tài nguyên tin đăng</h2>
        </div>
        <Link
          href="/bang-gia"
          className="text-[12.5px] font-semibold text-[#E8872A] hover:text-[#d6761b]"
        >
          Nâng cấp gói →
        </Link>
      </div>

      <div className="mt-3.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-5">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-slate-100 bg-[#F8FAFC] px-3 py-2.5"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">{m.icon}</span>
              <p className="truncate text-[11.5px] font-medium text-slate-500">{m.label}</p>
            </div>
            <p
              className={clsx(
                'mt-1.5 truncate text-[17px] font-bold tabular-nums tracking-tight',
                isLoading ? 'text-slate-300' : 'text-[#072348]',
              )}
              title={m.value}
            >
              {isLoading ? '—' : m.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Phần 2 — "Danh sách gói tin đăng của tôi".
 *
 * Mỗi gói là 1 lần mua độc lập. Nhiều gói có thể cùng chạy (ACTIVE); bấm "Sử dụng gói này"
 * để kích hoạt đúng gói đó, không ảnh hưởng các gói khác.
 */
export function JobPackageList({
  onFilterJobs,
}: {
  /** Gọi khi NTD bấm "Xem tin đã gắn" → lọc danh sách tin bên dưới theo gói. */
  onFilterJobs?: (packageId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [activePkg, setActivePkg] = useState<RecruiterJobPackageView | null>(null);
  const [activeMode, setActiveMode] = useState<'choose' | 'existing'>('choose');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['recruiter-job-packages'],
    queryFn: fetchRecruiterJobPackages,
    retry: false,
  });

  const items = data?.items ?? [];

  return (
    <section className="brand-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Package className="h-4 w-4" />
          </span>
          <h2 className="text-[15px] font-bold text-[#072348]">
            Danh sách gói tin đăng của tôi
            <span className="ml-1.5 text-slate-400">({data?.total ?? 0})</span>
          </h2>
        </div>
      </div>

      {isError && (
        <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-[13px] text-slate-500">
          Không tải được danh sách gói tin đăng.
        </p>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
          <Package className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-[13.5px] font-semibold text-slate-700">Chưa có gói tin đăng nào</p>
          <p className="mt-1 text-[12.5px] text-slate-500">
            Mua gói Tin đăng để đăng tin tuyển dụng không giới hạn lượt.
          </p>
          <Link
            href="/bang-gia"
            className="mt-3 inline-flex h-9 items-center rounded-xl bg-[#E8872A] px-3.5 text-[12.5px] font-semibold text-white transition hover:bg-[#d6761b]"
          >
            Xem bảng giá
          </Link>
        </div>
      )}

      {isLoading && (
        <div className="mt-3 space-y-2.5">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100/80" />
          ))}
        </div>
      )}

      <div className="mt-3.5 space-y-2.5">
        {items.map((pkg) => (
          <JobPackageCard
            key={pkg.code}
            pkg={pkg}
            onUse={(mode) => {
              setActiveMode(mode);
              setActivePkg(pkg);
            }}
            onViewJobs={() => {
              onFilterJobs?.(pkg.id);
              document
                .getElementById('recruiter-job-list')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />
        ))}
      </div>

      {activePkg ? (
        <JobPackageApplyModal
          pkg={activePkg}
          initialMode={activeMode}
          onClose={() => setActivePkg(null)}
          onApplied={() => {
            queryClient.invalidateQueries({ queryKey: ['recruiter-job-packages'] });
            queryClient.invalidateQueries({ queryKey: ['recruiter-billing-entitlements'] });
            queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
          }}
        />
      ) : null}
    </section>
  );
}

function JobPackageCard({
  pkg,
  onUse,
  onViewJobs,
}: {
  pkg: RecruiterJobPackageView;
  onUse: (mode: 'choose' | 'existing') => void;
  onViewJobs: () => void;
}) {
  const statusMeta = PACKAGE_STATUS_META[pkg.status];
  // Chỉ gói UNUSED còn hạn mới kích hoạt được. Gói ACTIVE dùng song song với các gói khác.
  const canActivate = pkg.status === 'unused' && pkg.canActivate;
  const activationDays = daysUntil(pkg.activationDeadlineAt);
  // remainingJobs = totalJobs - usedJobs (null quota = không giới hạn).
  const remainingJobs =
    pkg.jobPostQuota == null ? null : Math.max(0, pkg.jobPostQuota - (pkg.jobsUsed ?? 0));
  const hasRemaining = remainingJobs == null || remainingJobs > 0;

  return (
    <article
      className={clsx(
        'rounded-xl border p-3.5 transition',
        pkg.status === 'active'
          ? 'border-[#FFD0A3] bg-[#FFF8F1]'
          : 'border-slate-100 bg-white hover:border-slate-200',
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-bold text-[#072348]">{pkg.planName}</p>
            {/* DUY NHẤT 1 badge trạng thái cạnh tên gói. */}
            <span
              className={clsx(
                'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                statusMeta.className,
              )}
            >
              {statusMeta.label}
            </span>
          </div>

          <p className="mt-1 text-[11.5px] font-medium text-slate-400">{pkg.code}</p>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-slate-400" />
              {pkg.jobPostQuota == null ? 'Không giới hạn tin' : `${pkg.jobPostQuota} tin`}
            </span>
            {pkg.creditQuota != null && pkg.creditQuota > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <CircleDollarSign className="h-3.5 w-3.5 text-slate-400" />
                {pkg.creditQuota} credit
              </span>
            )}
            {pkg.displayDays != null && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5 text-slate-400" />
                Hiển thị {pkg.displayDays} ngày
              </span>
            )}
            <span className="text-slate-400">Mua ngày {formatDate(pkg.purchasedAt)}</span>
            <span className="font-semibold text-[#E8872A]">
              {formatVndAmount(Number(pkg.priceVnd))}
              <span className="ml-1 font-medium text-slate-400">(chưa VAT)</span>
            </span>
          </div>

          {pkg.status === 'unused' && activationDays != null && (
            <p
              className={clsx(
                'mt-1.5 text-[11.5px] font-medium',
                activationDays <= 3 ? 'text-rose-600' : 'text-amber-600',
              )}
            >
              Hạn kích hoạt: còn {activationDays} ngày
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2.5 lg:w-[19rem] lg:justify-end">
          {pkg.status === 'active' && remainingJobs != null && (
            <div className="text-right">
              <p className="text-[11px] font-medium text-slate-500">Lượt tin còn lại</p>
              <p className="text-[15px] font-bold tabular-nums text-[#072348]">
                {remainingJobs}
                <span className="ml-1 text-[11.5px] font-medium text-slate-400">
                  / {pkg.jobPostQuota ?? '∞'}
                </span>
              </p>
            </div>
          )}

          {/* CTA động theo trạng thái + số lượt còn lại. */}
          {pkg.status === 'unused' ? (
            <button
              type="button"
              disabled={!canActivate}
              onClick={() => onUse('choose')}
              title={
                canActivate
                  ? `Kích hoạt gói ${pkg.planName} (${pkg.code})`
                  : 'Gói này không còn hiệu lực để kích hoạt'
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#E8872A] px-3.5 text-[12.5px] font-semibold text-white transition hover:bg-[#d6761b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Package className="h-3.5 w-3.5" />
              Sử dụng gói này
            </button>
          ) : pkg.status === 'active' && hasRemaining ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onUse('choose')}
                title={`Đăng tin mới bằng gói ${pkg.planName} (${pkg.code})`}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#E8872A] px-3.5 text-[12.5px] font-semibold text-white transition hover:bg-[#d6761b]"
              >
                <Briefcase className="h-3.5 w-3.5" />
                Đăng tin từ gói
              </button>
              <button
                type="button"
                onClick={() => onUse('existing')}
                title="Gắn gói này vào 1 tin tuyển dụng có sẵn"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-[12.5px] font-semibold text-[#072348] transition hover:border-brand-300 hover:bg-slate-50"
              >
                <Link2 className="h-3.5 w-3.5" />
                Gắn vào tin có sẵn
              </button>
            </div>
          ) : pkg.status === 'active' ? (
            // Gói đã dùng hết lượt → xem tin đã gắn + báo cáo gói.
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onViewJobs}
                title="Xem các tin đã dùng lượt đăng của gói này"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-[12.5px] font-semibold text-[#072348] transition hover:border-brand-300 hover:bg-slate-50"
              >
                <ListChecks className="h-3.5 w-3.5" />
                Xem tin đã gắn
              </button>
              <Link
                href="/recruiter/billing"
                title="Báo cáo sử dụng gói tin đăng"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-[12.5px] font-semibold text-[#072348] transition hover:border-brand-300 hover:bg-slate-50"
              >
                <FileBarChart className="h-3.5 w-3.5" />
                Báo cáo gói
              </Link>
            </div>
          ) : (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 text-[12.5px] font-semibold text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              Đã hết hạn
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function buildMetrics(
  summary:
    | {
        totalPackages: number;
        activePackages: number;
        unusedPackages: number;
        jobsRemaining: number | null;
        daysRemaining: number | null;
        topPackageName: string | null;
      }
    | undefined,
  items: RecruiterJobPackageView[] | undefined,
) {
  const totalPackages = summary?.totalPackages ?? 0;
  const activePackages = summary?.activePackages ?? 0;
  const unusedPackages = summary?.unusedPackages ?? 0;
  const topPackageName = summary?.topPackageName ?? 'Chưa có gói';

  // Lượt tin còn lại: ưu tiên tổng hợp gói; không có gói ACTIVE thì lấy từ entitlements.
  const jobsRemaining = summary?.jobsRemaining ?? null;

  // Ngày còn lại: sớm nhất trong các gói ACTIVE; nếu chưa có gói ACTIVE thì lấy hạn kích hoạt sớm nhất.
  let daysRemaining = summary?.daysRemaining ?? null;
  if (daysRemaining == null && items?.length) {
    const candidates = items
      .filter((i) => i.status === 'active' && i.endsAt)
      .map((i) => daysUntil(i.endsAt))
      .filter((d): d is number => d != null);
    if (candidates.length) daysRemaining = Math.min(...candidates);
  }

  return [
    {
      label: 'Gói đã mua',
      value: `${totalPackages} gói`,
      icon: <Package className="h-3.5 w-3.5" />,
    },
    {
      label: 'Gói đang chạy',
      value: `${activePackages} gói`,
      icon: <BadgeCheck className="h-3.5 w-3.5" />,
    },
    {
      label: 'Gói chờ kích hoạt',
      value: `${unusedPackages} gói`,
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    },
    {
      label: 'Lượt tin còn lại',
      value: jobsRemaining == null ? 'Không giới hạn' : `${jobsRemaining} tin`,
      icon: <Briefcase className="h-3.5 w-3.5" />,
    },
    {
      label: 'Ngày còn lại',
      value: daysRemaining == null ? '—' : `${daysRemaining} ngày`,
      icon: <CalendarClock className="h-3.5 w-3.5" />,
    },
  ];
}

/** Entitlements của NTD (credit, hạn hiển thị, gói cao nhất) — dùng ở header/sidebar. */
export function useRecruiterEntitlements() {
  return useQuery({
    queryKey: ['recruiter-billing-entitlements'],
    queryFn: fetchRecruiterEntitlements,
    retry: 1,
  });
}
