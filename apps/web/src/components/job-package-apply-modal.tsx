'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertCircle,
  Check,
  FilePlus2,
  Loader2,
  Package,
  RefreshCw,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { RecruiterJobPackageView } from '@industriallink/contracts';
import { ApiError } from '@/lib/api';
import {
  applyJobPackageToJob,
  fetchApplicableJobs,
} from '@/lib/recruiter-billing';

/** Nhãn trạng thái tin khi hiển thị danh sách "áp dụng cho tin có sẵn". */
const JOB_STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp',
  published: 'Đang tuyển',
  paused: 'Tạm dừng',
  closed: 'Đã đóng',
};

function jobStatusLabel(status: string): string {
  return JOB_STATUS_LABEL[status] ?? status;
}

type Mode = 'choose' | 'existing';

/**
 * Modal kích hoạt gói tin đăng — chống "kích hoạt rỗng".
 *
 * Luồng:
 * 1. NTD bấm "Sử dụng gói này" (gói UNUSED) hoặc "Đăng tin từ gói" / "Gắn vào tin có sẵn"
 *    (gói ACTIVE còn lượt) → mở modal này.
 * 2. Chọn 1 trong 2 lựa chọn:
 *    - "Tạo tin tuyển dụng mới bằng gói này" → điều hướng `/jobs/new?packageCode=<code>`,
 *      gói được chọn sẵn trong form. Gói chỉ được kích hoạt khi tin được đăng.
 *    - "Áp dụng cho tin tuyển dụng có sẵn" → chọn 1 tin rồi gọi
 *      `POST /billing/job-packages/:id/apply-job` (kích hoạt + gắn tin trong 1 transaction).
 */
export function JobPackageApplyModal({
  pkg,
  initialMode = 'choose',
  onClose,
  onApplied,
}: {
  pkg: RecruiterJobPackageView;
  /** Mở thẳng 1 trong 2 lựa chọn (theo nút NTD đã bấm). */
  initialMode?: Mode;
  onClose: () => void;
  onApplied?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['applicable-jobs'],
    queryFn: fetchApplicableJobs,
    enabled: mode === 'existing',
    retry: false,
  });

  const applyMutation = useMutation({
    mutationFn: (jobId: string) => applyJobPackageToJob(pkg.id, jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruiter-job-packages'] });
      queryClient.invalidateQueries({ queryKey: ['recruiter-billing-entitlements'] });
      queryClient.invalidateQueries({ queryKey: ['my-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['applicable-jobs'] });
      onApplied?.();
      onClose();
    },
  });

  // Đóng modal bằng ESC.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !applyMutation.isPending) onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, applyMutation.isPending]);

  const remaining = pkg.jobsRemaining;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Dùng gói ${pkg.planName}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !applyMutation.isPending) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#FFF8F1] text-[#E8872A]">
                <Package className="h-3.5 w-3.5" />
              </span>
              <h3 className="truncate text-[15px] font-bold text-[#072348]">
                {pkg.planName}
              </h3>
            </div>
            <p className="mt-1 text-[12px] font-medium text-slate-400">{pkg.code}</p>
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

        {/* Body */}
        <div className="px-5 py-4">
          {mode === 'choose' ? (
            <div className="space-y-2.5">
              <p className="text-[13px] leading-relaxed text-slate-600">
                {pkg.creditsGranted ? (
                  <>
                    Credit của gói đã được cộng vào ví dùng chung (
                    <strong className="font-semibold text-[#072348]">
                      {pkg.creditQuota ?? 0} Credit
                    </strong>
                    ). Chọn cách bạn muốn dùng gói này:
                  </>
                ) : (
                  <>
                    Gói sẽ được kích hoạt và cộng{' '}
                    <strong className="font-semibold text-[#072348]">
                      {pkg.creditQuota ?? 0} Credit
                    </strong>{' '}
                    vào ví dùng chung ngay khi tin được đăng. Chọn cách bạn muốn dùng gói
                    này:
                  </>
                )}
              </p>

              <OptionCard
                icon={<FilePlus2 className="h-4 w-4" />}
                title="Tạo tin tuyển dụng mới bằng gói này"
                description="Mở form đăng tin, gói này được chọn sẵn. Gói chỉ kích hoạt khi bạn bấm đăng tin."
                onClick={() => {
                  router.push(`/jobs/new?packageCode=${encodeURIComponent(pkg.code)}`);
                  onClose();
                }}
              />

              <OptionCard
                icon={<RefreshCw className="h-4 w-4" />}
                title="Áp dụng cho tin tuyển dụng có sẵn"
                description="Chọn 1 tin đang nháp, đã đóng/hết hạn hoặc đang dùng gói Khám phá để đăng lại bằng gói này."
                onClick={() => setMode('existing')}
              />
            </div>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="mb-3 text-[12.5px] font-semibold text-[#E8872A] hover:text-[#d6761b]"
              >
                ← Quay lại
              </button>

              <p className="text-[13px] font-semibold text-[#072348]">
                Chọn tin tuyển dụng để áp dụng gói
              </p>

              {jobsLoading ? (
                <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-[13px] text-slate-500">
                  Đang tải danh sách tin…
                </p>
              ) : (jobs ?? []).length === 0 ? (
                <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-[13px] text-slate-500">
                  Không có tin nào để áp dụng. Hãy tạo tin mới bằng gói này.
                </p>
              ) : (
                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                  {(jobs ?? []).map((job) => (
                    <label
                      key={job.id}
                      className={clsx(
                        'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition',
                        job.eligible === false
                          ? 'cursor-not-allowed border-slate-200 bg-slate-50/70 opacity-80'
                          : selectedJobId === job.id
                            ? 'cursor-pointer border-brand-300 bg-brand-50/60'
                            : 'cursor-pointer border-slate-200 bg-white hover:border-slate-300',
                      )}
                    >
                      <input
                        type="radio"
                        name="applicableJob"
                        disabled={job.eligible === false}
                        checked={selectedJobId === job.id}
                        onChange={() => setSelectedJobId(job.id)}
                        className="mt-0.5 h-4 w-4 accent-[#E8872A]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-[#072348]">
                          {job.title}
                        </span>
                        <span className="mt-0.5 block text-[11.5px] text-slate-500">
                          {job.code} · {jobStatusLabel(job.status)}
                          {job.jobPackageCode ? ` · gói ${job.jobPackageCode}` : ''}
                        </span>
                        {job.eligible === false && job.disabledReason ? (
                          <span className="mt-1 block text-[11px] font-medium leading-relaxed text-[#C25E12]">
                            {job.disabledReason}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {applyMutation.isError && (
            <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-rose-50 px-3 py-2.5 text-[12.5px] text-rose-600">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {applyMutation.error instanceof ApiError
                ? applyMutation.error.message
                : 'Không áp dụng được gói. Vui lòng thử lại.'}
            </p>
          )}
        </div>

        {/* Footer */}
        {mode === 'existing' && (
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
              disabled={!selectedJobId || applyMutation.isPending}
              onClick={() => selectedJobId && applyMutation.mutate(selectedJobId)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#E8872A] px-4 text-[12.5px] font-semibold text-white transition hover:bg-[#d6761b] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {applyMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Xác nhận áp dụng
            </button>
          </div>
        )}

        {mode === 'choose' && remaining != null && remaining > 0 && (
          <p className="border-t border-slate-100 px-5 py-2.5 text-[11.5px] text-slate-400">
            Gói này còn {remaining} lượt đăng.
          </p>
        )}
      </div>
    </div>
  );
}

function OptionCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-left transition hover:border-brand-300 hover:bg-brand-50/40"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-bold text-[#072348]">{title}</span>
        <span className="mt-1 block text-[12px] leading-relaxed text-slate-500">
          {description}
        </span>
      </span>
    </button>
  );
}
