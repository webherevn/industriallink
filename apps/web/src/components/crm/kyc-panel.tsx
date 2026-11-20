'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  BadgeCheck,
  CreditCard,
  Loader2,
  Maximize2,
  RotateCw,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { CrmKycReviewRowView, CrmKycSide, CrmKycStatus } from '@industriallink/contracts';
import { crmActionClass, crmButtonClass, crmFieldClass } from '@/components/crm-frame';
import { errorText } from '@/components/crm/format';
import { fetchCrmKycList, fetchKycImageBlob, reviewCrmKyc } from '@/lib/ctv-kyc';

const STATUS_META: Record<CrmKycStatus, { label: string; chip: string }> = {
  UNVERIFIED: { label: 'Chưa xác thực', chip: 'bg-amber-50 text-amber-800 ring-amber-200' },
  PENDING: { label: 'Chờ duyệt', chip: 'bg-blue-50 text-blue-700 ring-blue-200' },
  VERIFIED: { label: 'Đã xác thực', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  REJECTED: { label: 'Từ chối', chip: 'bg-rose-50 text-rose-700 ring-rose-200' },
};

const STATUS_FILTERS: Array<{ id: CrmKycStatus | 'all'; label: string }> = [
  { id: 'PENDING', label: 'Chờ duyệt' },
  { id: 'VERIFIED', label: 'Đã xác thực' },
  { id: 'REJECTED', label: 'Từ chối' },
  { id: 'UNVERIFIED', label: 'Chưa xác thực' },
  { id: 'all', label: 'Tất cả' },
];

/** Panel duyệt xác thực CTV (KYC) cho CRM Admin. Badge đỏ = số hồ sơ PENDING. */
export function CrmKycPanel() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<CrmKycStatus | 'all'>('PENDING');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CrmKycReviewRowView | null>(null);

  const list = useQuery({
    queryKey: ['crm-kyc', status, query],
    queryFn: () =>
      fetchCrmKycList({ status: status === 'all' ? '' : status, query }),
  });

  const rows = list.data?.rows ?? [];
  const pendingCount = list.data?.pendingCount ?? 0;

  return (
    <div className="space-y-4">
      {pendingCount > 0 ? (
        <div className="flex items-center gap-2 rounded-[22px] bg-rose-50 px-4 py-3 ring-1 ring-rose-200">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
          </span>
          <p className="text-sm font-semibold text-rose-800">
            {pendingCount} hồ sơ xác thực đang chờ duyệt
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-[22px] bg-white p-4 crm-surface lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStatus(item.id)}
              className={clsx(
                'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                status === item.id
                  ? 'bg-[#4c3ec9] text-white'
                  : 'bg-[#f6f4ff] text-slate-600 hover:bg-[#efeaff]',
              )}
            >
              {item.label}
              {item.id === 'PENDING' && pendingCount > 0 ? ` (${pendingCount})` : ''}
            </button>
          ))}
        </div>
        <input
          className={crmFieldClass}
          placeholder="Tìm tên, mã CTV, số CCCD"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {list.isLoading ? <KycEmpty>Đang tải hồ sơ xác thực…</KycEmpty> : null}
      {list.isError ? <KycEmpty>Không tải được danh sách hồ sơ xác thực.</KycEmpty> : null}
      {list.data && rows.length === 0 ? (
        <KycEmpty>Không có hồ sơ nào khớp bộ lọc.</KycEmpty>
      ) : null}

      {rows.length > 0 ? (
        <section className="overflow-hidden rounded-[22px] bg-white crm-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#efeaff] text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3 font-semibold">Cộng tác viên</th>
                  <th className="px-3 py-3 font-semibold">Họ tên / CCCD</th>
                  <th className="px-3 py-3 font-semibold">Ngân hàng</th>
                  <th className="px-3 py-3 font-semibold">Trạng thái</th>
                  <th className="px-5 py-3 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f0ff]">
                {rows.map((row) => (
                  <tr key={row.partnerId} className="transition hover:bg-[#faf8ff]">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[#072348]">{row.partnerName}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {row.partnerCode} · {row.partnerPhone}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <p className="text-[#072348]">{row.fullName ?? '—'}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">
                        {row.idNumber ?? 'Chưa có số CCCD'}
                      </p>
                      {row.holderMismatch ? (
                        <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">
                          <AlertTriangle className="h-3 w-3" />
                          Tên chủ tài khoản lệch
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-4">
                      <p className="text-slate-700">{row.bankName ?? '—'}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">
                        {row.bankAccountNumber ?? '—'}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className={clsx(
                          'rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
                          STATUS_META[row.status].chip,
                        )}
                      >
                        {STATUS_META[row.status].label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        className={crmActionClass}
                        onClick={() => setSelected(row)}
                      >
                        Xét duyệt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {selected ? (
        <CrmKycDrawer
          row={selected}
          onClose={() => setSelected(null)}
          onDone={() => {
            setSelected(null);
            void qc.invalidateQueries({ queryKey: ['crm-kyc'] });
          }}
        />
      ) : null}
    </div>
  );
}

function KycEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[22px] bg-white px-4 py-10 text-center text-sm text-slate-500 crm-surface">
      {children}
    </div>
  );
}

/** Drawer 2 cột: trái = ảnh CCCD, phải = thông tin khai báo + nút duyệt/từ chối. */
function CrmKycDrawer({
  row,
  onClose,
  onDone,
}: {
  row: CrmKycReviewRowView;
  onClose: () => void;
  onDone: () => void;
}) {
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const review = useMutation({
    mutationFn: (action: 'APPROVE' | 'REJECT') =>
      reviewCrmKyc(row.partnerId, {
        action,
        rejectReason: action === 'REJECT' ? rejectReason.trim() : undefined,
      }),
    onSuccess: () => {
      setError(null);
      onDone();
    },
    onError: (err) => setError(errorText(err, 'Không xử lý được hồ sơ')),
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-full w-full max-w-4xl flex-col overflow-y-auto bg-[#f7f5ff] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#efeaff] bg-white px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#072348]">
              Xét duyệt xác thực — {row.partnerName}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {row.partnerCode} · {row.partnerPhone}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid flex-1 gap-4 p-5 lg:grid-cols-2">
          <div className="space-y-4">
            <KycImagePanel
              partnerId={row.partnerId}
              side="front"
              label="Mặt trước CCCD"
              hasImage={row.hasFrontImage}
            />
            <KycImagePanel
              partnerId={row.partnerId}
              side="back"
              label="Mặt sau CCCD"
              hasImage={row.hasBackImage}
            />
          </div>

          <div className="space-y-4">
            <section className="rounded-[22px] bg-white p-4 crm-surface">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#4c3ec9]" />
                <h3 className="text-sm font-semibold text-[#072348]">Thông tin CTV khai báo</h3>
              </div>
              <dl className="mt-3 space-y-2.5 text-sm">
                <Field label="Họ và tên" value={row.fullName} />
                <Field label="Số CCCD" value={row.idNumber} mono />
                <Field
                  label="Ngày cấp"
                  value={row.idIssuedDate ? formatDate(row.idIssuedDate) : null}
                />
                <Field label="Nơi cấp" value={row.idIssuedPlace} />
                <Field label="MST cá nhân" value={row.personalTaxCode} mono />
                <Field label="Số điện thoại" value={row.phone} />
              </dl>
            </section>

            <section className="rounded-[22px] bg-white p-4 crm-surface">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#4c3ec9]" />
                <h3 className="text-sm font-semibold text-[#072348]">Tài khoản ngân hàng</h3>
              </div>
              <dl className="mt-3 space-y-2.5 text-sm">
                <Field label="Ngân hàng" value={row.bankName} />
                <Field label="Số tài khoản" value={row.bankAccountNumber} mono />
                <Field label="Chủ tài khoản" value={row.bankAccountHolder} />
              </dl>

              {row.holderMismatch ? (
                <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span>
                    <strong className="font-semibold">Cảnh báo:</strong> tên chủ tài khoản (
                    {row.bankAccountHolder ?? '—'}) không khớp với họ tên trên CCCD (
                    {row.fullName ?? '—'}). Kiểm tra kỹ trước khi phê duyệt.
                  </span>
                </p>
              ) : (
                <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800 ring-1 ring-emerald-200">
                  <BadgeCheck className="h-4 w-4 shrink-0" />
                  Tên chủ tài khoản khớp với họ tên trên CCCD.
                </p>
              )}
            </section>

            {row.kycRejectReason ? (
              <section className="rounded-[22px] bg-white p-4 crm-surface">
                <h3 className="text-sm font-semibold text-[#072348]">Lý do từ chối trước</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-rose-700">
                  {row.kycRejectReason}
                </p>
              </section>
            ) : null}
          </div>
        </div>

        <div className="sticky bottom-0 border-t border-[#efeaff] bg-white px-5 py-4">
          {error ? (
            <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : null}

          {rejecting ? (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                Lý do từ chối (bắt buộc — trả về cho CTV)
              </label>
              <textarea
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#4c3ec9]"
                rows={3}
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
                placeholder="Ví dụ: Ảnh mặt trước CCCD bị mờ, không đọc được số"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className={crmButtonClass}
                  onClick={() => {
                    setRejecting(false);
                    setRejectReason('');
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
                  disabled={rejectReason.trim().length < 3 || review.isPending}
                  onClick={() => review.mutate('REJECT')}
                >
                  {review.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  Xác nhận từ chối
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                disabled={review.isPending || row.status !== 'PENDING'}
                onClick={() => review.mutate('APPROVE')}
              >
                {review.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BadgeCheck className="h-4 w-4" />
                )}
                Phê duyệt xác thực
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                disabled={review.isPending || row.status !== 'PENDING'}
                onClick={() => setRejecting(true)}
              >
                <XCircle className="h-4 w-4" />
                Từ chối
              </button>
              {row.status !== 'PENDING' ? (
                <p className="flex items-center gap-1.5 self-center text-xs text-slate-500">
                  Hồ sơ đang ở trạng thái “{STATUS_META[row.status].label}” — không thể duyệt lại.
                </p>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Ảnh CCCD tải qua endpoint private. Có phóng to + xoay 90°. */
function KycImagePanel({
  partnerId,
  side,
  label,
  hasImage,
}: {
  partnerId: string;
  side: CrmKycSide;
  label: string;
  hasImage: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!hasImage) return;
    let cancelled = false;
    void fetchKycImageBlob(partnerId, side)
      .then((value) => {
        if (!cancelled) setUrl(value);
      })
      .catch(() => {
        if (!cancelled) setError('Không tải được ảnh. Kiểm tra quyền truy cập.');
      });
    return () => {
      cancelled = true;
    };
  }, [partnerId, side, hasImage]);

  return (
    <section className="rounded-[22px] bg-white p-4 crm-surface">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#072348]">{label}</h3>
        {url ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setRotation((value) => (value + 90) % 360)}
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100"
              title="Xoay 90°"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoomed(true)}
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100"
              title="Phóng to"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex min-h-40 items-center justify-center overflow-hidden rounded-xl bg-[#f6f4ff] p-2">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={label}
            className="max-h-64 w-auto max-w-full rounded-lg object-contain transition-transform"
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        ) : error ? (
          <p className="px-4 text-center text-xs text-rose-600">{error}</p>
        ) : hasImage ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        ) : (
          <p className="px-4 text-center text-xs text-slate-400">CTV chưa tải ảnh này</p>
        )}
      </div>

      {zoomed && url ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 p-4">
          <button
            type="button"
            className="absolute inset-0 cursor-zoom-out"
            aria-label="Đóng"
            onClick={() => setZoomed(false)}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={label}
            className="relative z-10 max-h-full max-w-full rounded-lg object-contain"
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        </div>
      ) : null}
    </section>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-xs font-medium text-slate-500">{label}</dt>
      <dd
        className={clsx(
          'min-w-0 break-words text-right text-sm text-[#072348]',
          mono && 'font-mono text-xs',
        )}
      >
        {value || '—'}
      </dd>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}
