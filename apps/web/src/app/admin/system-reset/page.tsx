'use client';

import type { AdminSystemResetResultView } from '@industriallink/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  FileCheck2,
  KeyRound,
  Lock,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button, Field, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { executeSystemReset, fetchSystemResetPreview } from '@/lib/admin-users';

const REQUIRED_PHRASE = 'RESET INLINK';

export default function AdminSystemResetPage() {
  const queryClient = useQueryClient();
  const [keepEditors, setKeepEditors] = useState(true);
  const [keepSalesStaff, setKeepSalesStaff] = useState(false);
  const [clearAnalyticsAndAudit, setClearAnalyticsAndAudit] = useState(true);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AdminSystemResetResultView | null>(null);

  const previewQuery = useQuery({
    queryKey: ['admin-system-reset-preview'],
    queryFn: fetchSystemResetPreview,
  });

  const resetMutation = useMutation({
    mutationFn: () =>
      executeSystemReset({
        confirmPhrase,
        password,
        keepEditors,
        keepSalesStaff,
        clearAnalyticsAndAudit,
      }),
    onSuccess: (res) => {
      setResult(res);
      setError(null);
      setConfirmPhrase('');
      setPassword('');
      void queryClient.invalidateQueries({ queryKey: ['admin-system-reset-preview'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Thực thi Reset dữ liệu thất bại');
    },
  });

  const preview = previewQuery.data;
  const phraseMatched = confirmPhrase.trim().toUpperCase() === REQUIRED_PHRASE;
  const canSubmit = phraseMatched && password.length > 0 && !resetMutation.isPending;

  const totalUsersToDelete = preview
    ? preview.recruiterUserCount +
      preview.candidateUserCount +
      (keepEditors ? 0 : preview.editorCount) +
      (keepSalesStaff ? 0 : preview.salesStaffCount)
    : 0;

  const totalUsersToKeep = preview
    ? preview.superAdminCount +
      (keepEditors ? preview.editorCount : 0) +
      (keepSalesStaff ? preview.salesStaffCount : 0)
    : 0;

  return (
    <AdminShell>
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-200">
              <RotateCcw className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">
                  Reset dữ liệu Go-Live (Xoá dữ liệu Test)
                </h1>
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-rose-700">
                  Chỉ SuperAdmin
                </span>
              </div>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">
                Dọn sạch toàn bộ tài khoản người dùng thử nghiệm, công ty, tin tuyển dụng, hồ sơ ứng viên, đơn hàng và dữ liệu giao dịch CRM về trạng thái ban đầu để sẵn sàng chạy Marketing chính thức —{' '}
                <strong className="font-semibold text-slate-900">
                  giữ nguyên 100% tài khoản SuperAdmin, bài viết CMS, SEO, bảng giá và cấu hình hệ thống.
                </strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void previewQuery.refetch()}
            disabled={previewQuery.isFetching}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            <RefreshCw className={clsx('h-3.5 w-3.5', previewQuery.isFetching && 'animate-spin')} />
            Làm mới số liệu
          </button>
        </div>

        {/* Result Banner */}
        {result && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-5 shadow-xs">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
              <div className="flex-1">
                <h2 className="text-base font-bold text-emerald-950">
                  Đã Reset dữ liệu Go-Live thành công!
                </h2>
                <p className="mt-1 text-xs text-emerald-800">
                  Thời điểm thực hiện: {new Date(result.resetAt).toLocaleString('vi-VN')} · Bộ đếm mã nghiệp vụ (CAN, COM, JOB, LEA...) đã được đưa về 000001.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                  <div className="rounded-xl bg-white/90 px-3 py-2 ring-1 ring-emerald-200/80">
                    <p className="text-[11px] text-slate-500">Tài khoản giữ lại</p>
                    <p className="text-base font-bold text-emerald-700">{result.keptUsersCount}</p>
                  </div>
                  <div className="rounded-xl bg-white/90 px-3 py-2 ring-1 ring-emerald-200/80">
                    <p className="text-[11px] text-slate-500">Tài khoản đã xoá</p>
                    <p className="text-base font-bold text-slate-900">{result.deletedUsersCount}</p>
                  </div>
                  <div className="rounded-xl bg-white/90 px-3 py-2 ring-1 ring-emerald-200/80">
                    <p className="text-[11px] text-slate-500">Công ty đã xoá</p>
                    <p className="text-base font-bold text-slate-900">{result.deletedCompaniesCount}</p>
                  </div>
                  <div className="rounded-xl bg-white/90 px-3 py-2 ring-1 ring-emerald-200/80">
                    <p className="text-[11px] text-slate-500">Tin JD đã xoá</p>
                    <p className="text-base font-bold text-slate-900">{result.deletedJobsCount}</p>
                  </div>
                  <div className="rounded-xl bg-white/90 px-3 py-2 ring-1 ring-emerald-200/80">
                    <p className="text-[11px] text-slate-500">Hồ sơ UV đã xoá</p>
                    <p className="text-base font-bold text-slate-900">{result.deletedCandidatesCount}</p>
                  </div>
                  <div className="rounded-xl bg-white/90 px-3 py-2 ring-1 ring-emerald-200/80">
                    <p className="text-[11px] text-slate-500">Đơn & Lead đã xoá</p>
                    <p className="text-base font-bold text-slate-900">
                      {result.deletedOrdersCount + result.deletedCrmLeadsCount}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2 Columns: Protected vs Deleted */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Column 1: Giữ nguyên */}
          <div className="rounded-2xl border border-emerald-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Dữ liệu & Cấu hình ĐƯỢC BẢO TOÀN 100%
                </h2>
                <p className="text-xs text-slate-500">
                  Không ảnh hưởng đến code, giao diện hay luồng vận hành
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-2.5 text-[13px] text-slate-700">
              <li className="flex items-start gap-2.5 rounded-xl bg-emerald-50/50 px-3 py-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div>
                  <span className="font-semibold text-slate-900">
                    Tài khoản Quản trị ({totalUsersToKeep} tài khoản):
                  </span>{' '}
                  Giữ nguyên toàn bộ <strong>{preview?.superAdminCount ?? '—'} SuperAdmin</strong>
                  {keepEditors ? `, ${preview?.editorCount ?? 0} Biên tập viên` : ''}
                  {keepSalesStaff ? `, ${preview?.salesStaffCount ?? 0} Nhân sự Sales` : ''}.
                </div>
              </li>
              <li className="flex items-start gap-2.5 px-3 py-1">
                <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <strong>Nội dung CMS & SEO:</strong> Toàn bộ Bài viết cẩm nang, Chuyên mục, Trang tĩnh, Cấu hình Trang chủ Hero, Menu, Chân trang, Redirect 301, Robots.txt, Header/Footer code.
                </span>
              </li>
              <li className="flex items-start gap-2.5 px-3 py-1">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <strong>Cấu hình Bảng giá & AI:</strong> 5 gói Nền tảng, 3 gói Săn nhân sự, gói Top-up Credit, quy tắc trừ Credit, cổng Stripe, API Key AI (Gemini/OpenAI/Anthropic) & bộ từ điển Kỹ năng.
                </span>
              </li>
              <li className="flex items-start gap-2.5 px-3 py-1">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <strong>Cấu hình khung CRM:</strong> Các bước phễu bán hàng (Pipeline & Stages), Kênh Marketing, % Hoa hồng CTV, thuế suất VAT, mẫu tờ Báo giá & câu chào Robot.
                </span>
              </li>
            </ul>
          </div>

          {/* Column 2: Sẽ xoá sạch */}
          <div className="rounded-2xl border border-rose-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600 ring-1 ring-rose-200">
                <Trash2 className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Dữ liệu Test SẼ ĐƯỢC XOÁ SẠCH
                </h2>
                <p className="text-xs text-slate-500">
                  Số lượng thống kê trực tiếp từ cơ sở dữ liệu hiện tại
                </p>
              </div>
            </div>

            {previewQuery.isLoading ? (
              <p className="py-10 text-center text-xs text-slate-400">Đang tải thống kê dữ liệu...</p>
            ) : preview ? (
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
                  <p className="text-[11px] font-medium text-slate-500">Tài khoản NTD</p>
                  <p className="mt-1 text-lg font-bold text-rose-600">
                    {preview.recruiterUserCount.toLocaleString('vi-VN')}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
                  <p className="text-[11px] font-medium text-slate-500">Tài khoản Ứng viên</p>
                  <p className="mt-1 text-lg font-bold text-rose-600">
                    {preview.candidateUserCount.toLocaleString('vi-VN')}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
                  <p className="text-[11px] font-medium text-slate-500">Hồ sơ Công ty</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {preview.companyCount.toLocaleString('vi-VN')}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
                  <p className="text-[11px] font-medium text-slate-500">Tin tuyển dụng (JD)</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {preview.jobCount.toLocaleString('vi-VN')}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
                  <p className="text-[11px] font-medium text-slate-500">Hồ sơ Ứng viên & CV</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {preview.candidateProfileCount.toLocaleString('vi-VN')}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
                  <p className="text-[11px] font-medium text-slate-500">Đơn ứng tuyển</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {preview.applicationCount.toLocaleString('vi-VN')}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
                  <p className="text-[11px] font-medium text-slate-500">Đơn mua gói / Credit</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {preview.billingOrderCount.toLocaleString('vi-VN')}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
                  <p className="text-[11px] font-medium text-slate-500">Lead & Deal CRM</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {(preview.crmLeadCount + preview.crmDealCount).toLocaleString('vi-VN')}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3">
                  <p className="text-[11px] font-medium text-slate-500">Cộng tác viên CRM</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {preview.crmPartnerCount.toLocaleString('vi-VN')}
                  </p>
                </div>
              </div>
            ) : null}

            <p className="mt-3 text-xs text-slate-500">
              * Toàn bộ bộ đếm mã tự động (<code className="rounded bg-slate-100 px-1 py-0.5">CAN-2026-xxxxxx</code>,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">COM-2026-xxxxxx</code>,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">JOB-2026-xxxxxx</code>,{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5">LEA-2026-xxxxxx</code>) sẽ được đặt lại về{' '}
              <strong>000001</strong>.
            </p>
          </div>
        </div>

        {/* Options & Execution Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            resetMutation.mutate();
          }}
          className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs"
        >
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Users className="h-4 w-4 text-brand-600" />
            1. Tuỳ chọn phạm vi giữ lại / làm sạch
          </h2>

          <div className="mt-3.5 grid gap-3 sm:grid-cols-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200/90 bg-slate-50/60 p-3.5 transition hover:border-slate-300 hover:bg-white">
              <input
                type="checkbox"
                checked={keepEditors}
                onChange={(e) => setKeepEditors(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600"
              />
              <div className="text-xs">
                <p className="font-bold text-slate-900">
                  Giữ tài khoản Biên tập viên ({preview?.editorCount ?? 0})
                </p>
                <p className="mt-0.5 text-slate-500">
                  Giữ các tài khoản Editor và hồ sơ tác giả bài viết CMS.
                </p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200/90 bg-slate-50/60 p-3.5 transition hover:border-slate-300 hover:bg-white">
              <input
                type="checkbox"
                checked={keepSalesStaff}
                onChange={(e) => setKeepSalesStaff(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600"
              />
              <div className="text-xs">
                <p className="font-bold text-slate-900">
                  Giữ tài khoản Nhân sự Sales ({preview?.salesStaffCount ?? 0})
                </p>
                <p className="mt-0.5 text-slate-500">
                  Bật nếu bạn đã tạo tài khoản thật cho đội kinh doanh trên CRM.
                </p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200/90 bg-slate-50/60 p-3.5 transition hover:border-slate-300 hover:bg-white">
              <input
                type="checkbox"
                checked={clearAnalyticsAndAudit}
                onChange={(e) => setClearAnalyticsAndAudit(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600"
              />
              <div className="text-xs">
                <p className="font-bold text-slate-900">
                  Làm sạch Analytics & Nhật ký ({preview?.analyticsHitCount ?? 0})
                </p>
                <p className="mt-0.5 text-slate-500">
                  Xoá lịch sử lượt xem trang test và nhật ký cũ để đo lường Marketing từ 0.
                </p>
              </div>
            </label>
          </div>

          <div className="my-6 border-t border-slate-100" />

          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Lock className="h-4 w-4 text-rose-600" />
            2. Xác nhận bảo mật 2 lớp
          </h2>

          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-900">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p>
                Thao tác này sẽ xoá vĩnh viễn{' '}
                <strong>{totalUsersToDelete.toLocaleString('vi-VN')} tài khoản người dùng</strong>,{' '}
                <strong>{(preview?.companyCount ?? 0).toLocaleString('vi-VN')} công ty</strong> và{' '}
                <strong>{(preview?.jobCount ?? 0).toLocaleString('vi-VN')} tin tuyển dụng</strong>{' '}
                trong một giao dịch nguyên tử (Atomic Transaction). Không thể hoàn tác sau khi thực thi.
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field
              label={`Nhập cụm từ xác nhận: ${REQUIRED_PHRASE}`}
              description="Viết hoa hoặc viết thường đều được"
            >
              <Input
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                placeholder={REQUIRED_PHRASE}
                autoComplete="off"
              />
            </Field>

            <Field
              label="Mật khẩu SuperAdmin hiện tại của bạn"
              description="Hệ thống xác thực mật khẩu Argon2id trước khi xoá"
            >
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu tài khoản SuperAdmin..."
                  className="pl-9"
                  autoComplete="current-password"
                />
              </div>
            </Field>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-500">
              Trạng thái xác nhận:{' '}
              {phraseMatched ? (
                <span className="font-semibold text-emerald-600">Đã khớp cụm từ xác nhận</span>
              ) : (
                <span className="font-medium text-slate-400">Chưa nhập cụm từ &ldquo;{REQUIRED_PHRASE}&rdquo;</span>
              )}
            </p>

            <Button
              type="submit"
              disabled={!canSubmit}
              className={clsx(
                'inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm transition',
                canSubmit
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'cursor-not-allowed bg-slate-300 text-slate-500',
              )}
            >
              <RotateCcw className={clsx('h-4 w-4', resetMutation.isPending && 'animate-spin')} />
              {resetMutation.isPending
                ? 'Đang dọn sạch dữ liệu...'
                : 'Thực thi Reset dữ liệu Go-Live'}
            </Button>
          </div>
        </form>
      </div>
    </AdminShell>
  );
}
