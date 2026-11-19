'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlertCircle, Check, Loader2, Package, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { RecruiterJobPackageView } from '@industriallink/contracts';
import { ApiError } from '@/lib/api';
import { applyJobPackageToJob, fetchRecruiterJobPackages } from '@/lib/recruiter-billing';

/**
 * Modal chọn gói để "đăng lại tin" cho 1 tin đã đóng / hết hạn / dùng gói Khám phá.
 *
 * Chỉ hiện các gói dùng được: `UNUSED` (chờ kích hoạt) và `ACTIVE` còn lượt đăng.
 * Khi xác nhận → gọi `POST /billing/job-packages/:id/apply-job`:
 * kích hoạt gói (nếu UNUSED) + gắn gói + đăng tin, tất cả trong 1 transaction.
 */
export function JobRepostPackageModal({
  jobId,
  jobTitle,
  onClose,
  onDone,
}: {
  jobId: string;
  jobTitle: string;
  onClose: () => void;
  onDone?: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['recruiter-job-packages'],
    queryFn: fetchRecruiterJobPackages,
    retry: false,
  });

  const applyMutation = useMutation({
    mutationFn: (packageId: string) => applyJobPackageToJob(packageId, jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruiter-job-packages'] });
      queryClient.invalidateQueries({ queryKey: ['recruiter-billing-entitlements'] });
      queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
      onDone?.();
      onClose();
    },
  });

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !applyMutation.isPending) onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, applyMutation.isPending]);

  const items = data?.items ?? [];
  const usable: RecruiterJobPackageView[] = items.filter(
    (pkg) =>
      (pkg.status === 'unused' && pkg.canActivate) ||
      (pkg.status === 'active' && pkg.canPostJob),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Đăng lại tin"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !applyMutation.isPending) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#FFF8F1] text-[#E8872A]">
                <Package className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-[15px] font-bold text-[#072348]">Đăng lại tin</h3>
            </div>
            <p className="mt-1 truncate text-[12px] font-medium text-slate-500">{jobTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={applyMutation.isPending}
            aria-label="Đóng"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-[13px] leading-relaxed text-slate-600">
            Chọn gói tin đăng để đăng lại tin này. Gói được kích hoạt và cộng Credit ngay khi
            áp dụng.
          </p>

          {isLoading ? (
            <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-[13px] text-slate-500">
              Đang tải gói tin đăng…
            </p>
          ) : usable.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-[13px] text-slate-500">
              Chưa có gói tin đăng nào còn lượt. Hãy mua thêm gói ở trang bảng giá.
            </p>
          ) : (
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
              {usable.map((pkg) => {
                const remaining =
                  pkg.jobPostQuota == null
                    ? null
                    : Math.max(0, pkg.jobPostQuota - (pkg.jobsUsed ?? 0));
                return (
                  <label
                    key={pkg.code}
                    className={clsx(
                      'flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 transition',
                      selectedPkgId === pkg.id
                        ? 'border-brand-300 bg-brand-50/60'
                        : 'border-slate-200 bg-white hover:border-slate-300',
                    )}
                  >
                    <input
                      type="radio"
                      name="repostPackage"
                      checked={selectedPkgId === pkg.id}
                      onChange={() => setSelectedPkgId(pkg.id)}
                      className="mt-0.5 h-4 w-4 accent-[#E8872A]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-[#072348]">
                          {pkg.planName}
                        </span>
                        <span
                          className={clsx(
                            'inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-semibold',
                            pkg.status === 'unused'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200',
                          )}
                        >
                          {pkg.status === 'unused' ? 'Chờ kích hoạt' : 'Đang sử dụng'}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[11.5px] text-slate-500">
                        {pkg.code} · còn {remaining ?? '∞'} lượt đăng
                        {pkg.creditQuota ? ` · ${pkg.creditQuota} credit` : ''}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {applyMutation.isError && (
            <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-rose-50 px-3 py-2.5 text-[12.5px] text-rose-600">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {applyMutation.error instanceof ApiError
                ? applyMutation.error.message
                : 'Không đăng lại được tin. Vui lòng thử lại.'}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 px-5 py-3.5">
          <button
            type="button"
            onClick={onClose}
            disabled={applyMutation.isPending}
            className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3.5 text-[12.5px] font-semibold text-[#072348] transition hover:bg-slate-50 disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            disabled={!selectedPkgId || applyMutation.isPending}
            onClick={() => selectedPkgId && applyMutation.mutate(selectedPkgId)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#E8872A] px-4 text-[12.5px] font-semibold text-white transition hover:bg-[#d6761b] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {applyMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Đăng lại tin
          </button>
        </div>
      </div>
    </div>
  );
}
