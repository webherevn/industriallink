'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RecruiterShell } from '@/components/recruiter-shell';
import { ApiError } from '@/lib/api';
import { fetchBankTransferOrder } from '@/lib/recruiter-billing';

function fmtVnd(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return `${raw}đ`;
  return `${n.toLocaleString('vi-VN')}đ`;
}

export default function RecruiterBankTransferPage() {
  const qc = useQueryClient();
  const [orderId, setOrderId] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('order')?.trim() ?? '';
    setOrderId(id);
  }, []);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['bank-transfer-order', orderId],
    queryFn: () => fetchBankTransferOrder(orderId),
    enabled: Boolean(orderId),
    refetchInterval: (q) => (q.state.data?.order.status === 'pending' ? 5000 : false),
    retry: 1,
  });

  const paid = data?.order.status === 'paid';
  const failed = data?.order.status === 'failed';

  useEffect(() => {
    if (!paid) return;
    void qc.invalidateQueries({ queryKey: ['recruiter-billing-overview'] });
    void qc.invalidateQueries({ queryKey: ['recruiter-orders'] });
    void qc.invalidateQueries({ queryKey: ['recruiter-entitlements'] });
    void qc.invalidateQueries({ queryKey: ['recruiter-credit-balance'] });
    void qc.invalidateQueries({ queryKey: ['recruiter-sourcing'] });
  }, [paid, qc]);

  async function copyText(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // ignore clipboard errors
    }
  }

  return (
    <RecruiterShell>
      <div className="mx-auto max-w-4xl space-y-5 pb-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/recruiter/billing"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-[#072348]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Quay lại Gói dịch vụ &amp; Ví Credit</span>
            </Link>
            <h1 className="mt-1.5 text-xl font-extrabold tracking-tight text-[#072348] sm:text-2xl">
              Thanh toán chuyển khoản doanh nghiệp (VietQR)
            </h1>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              Quét mã QR hoặc chuyển khoản từ tài khoản công ty đúng số tiền và nội dung để hệ thống
              tự động kích hoạt gói/Credit và hỗ trợ xuất hóa đơn GTGT.
            </p>
          </div>
        </div>

        {!orderId ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
            Không tìm thấy mã đơn hàng. Vui lòng tạo đơn từ trang Gói dịch vụ hoặc Nạp Credit.
          </div>
        ) : isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-80 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-80 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        ) : isError || !data ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
            {error instanceof ApiError
              ? error.message
              : 'Không tải được thông tin chuyển khoản. Vui lòng thử lại.'}
          </div>
        ) : paid ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-8 w-8" />
            </span>
            <h2 className="mt-4 text-xl font-extrabold text-[#072348]">
              Thanh toán thành công!
            </h2>
            <p className="mt-1.5 text-sm text-slate-600">
              Đơn hàng{' '}
              <strong className="text-[#072348]">
                {data.order.planName ||
                  (data.order.kind === 'topup'
                    ? `Top-up ${data.order.creditCountSnapshot} Credit`
                    : 'Gói dịch vụ')}
              </strong>{' '}
              ({fmtVnd(data.payableVnd)}) đã được xác nhận và kích hoạt vào tài khoản doanh nghiệp.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href={
                  data.order.kind === 'sourcing' ? '/recruiter/sourcing' : '/recruiter/billing'
                }
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#072348] px-5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0d3468]"
              >
                {data.order.kind === 'sourcing'
                  ? 'Mở không gian Săn nhân sự'
                  : 'Xem Gói & Ví Credit'}
              </Link>
              <Link
                href="/jobs/manage"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Quản lý tin tuyển dụng
              </Link>
            </div>
          </div>
        ) : failed ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-8 text-center">
            <h2 className="text-lg font-bold text-rose-800">Đơn hàng đã bị huỷ</h2>
            <p className="mt-1 text-sm text-rose-700">
              {data.order.note || 'Đơn hàng này không còn hiệu lực. Bạn có thể tạo đơn mới.'}
            </p>
            <Link
              href="/recruiter/pricing"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-xl bg-[#072348] px-5 text-xs font-bold text-white"
            >
              Quay lại Bảng giá
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
            {/* Cột trái: Mã VietQR động */}
            <div className="flex flex-col items-center justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="w-full text-center">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-inset ring-amber-200">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Đang chờ xác nhận chuyển khoản (tự cập nhật mỗi 5 giây)
                </span>
                <div className="mt-4 flex justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={data.qrImageUrl}
                    alt={`Mã VietQR chuyển khoản ${data.transferCode}`}
                    className="h-auto w-full max-w-[280px] rounded-xl border border-slate-100 shadow-xs"
                  />
                </div>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500">
                  <QrCode className="h-3.5 w-3.5 text-[#072348]" />
                  <span>Quét bằng app ngân hàng để tự điền số tiền &amp; nội dung</span>
                </p>
              </div>

              <div className="mt-4 w-full rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                <p className="flex items-center gap-1.5 font-semibold text-[#072348]">
                  <Building2 className="h-3.5 w-3.5" />
                  Thông tin xuất hóa đơn GTGT
                </p>
                <p className="mt-1 truncate font-medium text-slate-800">{data.companyName}</p>
                <p className="text-[11.5px] text-slate-500">
                  MST: {data.companyTaxCode || 'Chưa cập nhật (bổ sung trong Hồ sơ công ty)'}
                </p>
              </div>
            </div>

            {/* Cột phải: Bảng thông tin CK chi tiết cho kế toán */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
              <div className="space-y-4">
                <div className="rounded-xl bg-[#072348] p-4 text-white">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
                    Tổng tiền thanh toán (đã gồm VAT)
                  </p>
                  <p className="mt-1 text-2xl font-extrabold tracking-tight text-[#FFB366]">
                    {fmtVnd(data.payableVnd)}
                  </p>
                  <p className="mt-1 text-xs text-white/80">
                    {data.order.planName ||
                      (data.order.kind === 'topup'
                        ? `Top-up ${data.order.creditCountSnapshot} Credit`
                        : 'Gói dịch vụ')}
                    {data.order.vatPercent
                      ? ` · Giá chưa VAT ${fmtVnd(data.order.priceVndSnapshot)} + VAT ${data.order.vatPercent}% (${fmtVnd(data.order.vatAmountVnd)})`
                      : ''}
                  </p>
                </div>

                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200/80 px-4">
                  <CopyRow
                    label="Ngân hàng"
                    value={
                      data.bankBranch ? `${data.bankName} — ${data.bankBranch}` : data.bankName
                    }
                    copied={copiedKey === 'bank'}
                    onCopy={() => void copyText('bank', data.bankName)}
                  />
                  <CopyRow
                    label="Số tài khoản"
                    value={data.bankAccountNumber}
                    mono
                    copied={copiedKey === 'acc'}
                    onCopy={() => void copyText('acc', data.bankAccountNumber)}
                  />
                  <CopyRow
                    label="Chủ tài khoản"
                    value={data.bankAccountName}
                    copied={copiedKey === 'holder'}
                    onCopy={() => void copyText('holder', data.bankAccountName)}
                  />
                  <CopyRow
                    label="Số tiền chính xác"
                    value={fmtVnd(data.payableVnd)}
                    highlight
                    copied={copiedKey === 'amount'}
                    onCopy={() => void copyText('amount', data.payableVnd)}
                  />
                  <CopyRow
                    label="Nội dung chuyển khoản"
                    value={data.transferCode}
                    mono
                    highlight
                    copied={copiedKey === 'code'}
                    onCopy={() => void copyText('code', data.transferCode)}
                  />
                </div>

                <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-3.5 text-xs leading-relaxed text-amber-900">
                  <p className="flex items-center gap-1.5 font-bold">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-amber-700" />
                    Lưu ý quan trọng cho kế toán doanh nghiệp
                  </p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4">
                    <li>
                      Vui lòng giữ đúng nội dung <strong>{data.transferCode}</strong> và đúng số
                      tiền <strong>{fmtVnd(data.payableVnd)}</strong> để hệ thống tự động kích hoạt
                      trong 1–2 phút.
                    </li>
                    <li>
                      Nếu kế toán chuyển khoản sau, bạn có thể đóng trang này — đơn vẫn được lưu tại
                      mục <strong>Lịch sử hóa đơn &amp; thanh toán</strong> để mở lại mã QR bất kỳ
                      lúc nào.
                    </li>
                    {data.bankTransferNote ? <li>{data.bankTransferNote}</li> : null}
                  </ul>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Đơn tạo lúc {new Date(data.order.createdAt).toLocaleString('vi-VN')}
                </span>
                <Link
                  href="/recruiter/billing"
                  className="font-semibold text-[#072348] hover:underline"
                >
                  Đóng &amp; quay lại ví Credit
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </RecruiterShell>
  );
}

function CopyRow({
  label,
  value,
  mono,
  highlight,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-slate-500">{label}</p>
        <p
          className={`mt-0.5 break-all text-xs sm:text-sm ${
            mono ? 'font-mono' : ''
          } ${highlight ? 'font-extrabold text-[#072348]' : 'font-semibold text-slate-800'}`}
        >
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100"
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-emerald-700">Đã copy</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            <span>Copy</span>
          </>
        )}
      </button>
    </div>
  );
}
