'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import type { AdminVerificationQueueItem } from '@industriallink/contracts';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { fetchVerificationQueue, reviewCompanyVerification } from '@/lib/admin-companies';

const TABS = [
  { value: 'pending', label: 'Đang chờ' },
  { value: 'approved', label: 'Đã duyệt' },
  { value: 'rejected', label: 'Từ chối' },
  { value: 'all', label: 'Tất cả' },
] as const;

export function AdminVerificationPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<(typeof TABS)[number]['value']>('pending');
  const [error, setError] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-verification', status],
    queryFn: () => fetchVerificationQueue(status),
  });

  const review = useMutation({
    mutationFn: (vars: {
      id: string;
      decision: 'approve' | 'reject';
      verified?: boolean;
      trustedEmployer?: boolean;
      reviewNote?: string;
    }) =>
      reviewCompanyVerification(vars.id, {
        decision: vars.decision,
        verified: vars.verified,
        trustedEmployer: vars.trustedEmployer,
        reviewNote: vars.reviewNote,
      }),
    onSuccess: async () => {
      setError(null);
      await qc.invalidateQueries({ queryKey: ['admin-verification'] });
      await qc.invalidateQueries({ queryKey: ['admin-companies'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Không xử lý được đơn'),
  });

  return (
    <AdminShell>
      <div className="admin-dash-rise">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E8872A]">Nền tảng</p>
        <h1 className="cms-page-title mt-1.5">Xác minh NTD</h1>
        <div className="brand-accent-bar mt-2" />
        <p className="cms-page-subtitle max-w-2xl">
          Nhà tuyển dụng gửi đơn xin huy hiệu. Họ không tự bật được «Đã xác thực» hay «Nhà tuyển dụng
          uy tín». Duyệt ở đây, hoặc chỉnh tay trong{' '}
          <Link href="/admin/companies" className="font-semibold text-[#E8872A] hover:underline">
            Công ty
          </Link>
          .
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setStatus(t.value)}
            className={
              status === t.value
                ? 'rounded-full bg-[#072348] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_10px_20px_-12px_rgba(7,35,72,0.9)]'
                : 'rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-[#FFF8F1] hover:text-[#072348]'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            <div className="admin-dash-skel h-24 rounded-2xl" />
            <div className="admin-dash-skel h-24 rounded-2xl" />
          </div>
        ) : data.length === 0 ? (
          <div className="rounded-[1.15rem] border border-dashed border-[#FFD0A3] bg-[#FFF8F1] px-3 py-10 text-center text-sm text-slate-500">
            Không có đơn ở mục này.
          </div>
        ) : (
          data.map((item) => (
            <QueueCard
              key={`${item.companyId}-${item.requestedAt}`}
              item={item}
              busy={review.isPending && review.variables?.id === item.companyId}
              onReview={(body) => review.mutate({ id: item.companyId, ...body })}
            />
          ))
        )}
      </div>
    </AdminShell>
  );
}

function QueueCard({
  item,
  busy,
  onReview,
}: {
  item: AdminVerificationQueueItem;
  busy: boolean;
  onReview: (body: {
    decision: 'approve' | 'reject';
    verified?: boolean;
    trustedEmployer?: boolean;
    reviewNote?: string;
  }) => void;
}) {
  const [verified, setVerified] = useState(item.askVerified || item.verified);
  const [trusted, setTrusted] = useState(item.askTrusted || item.trustedEmployer);
  const [note, setNote] = useState('');
  const pending = item.requestStatus === 'pending';

  return (
    <Card className="admin-dash-card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link
            href={`/admin/companies/${item.companyId}`}
            className="font-semibold text-[#072348] hover:text-[#E8872A]"
          >
            {item.companyName}
          </Link>
          <p className="text-xs text-slate-500">
            {item.companyCode}
            {item.requestedByEmail ? ` · ${item.requestedByEmail}` : ''} ·{' '}
            {new Date(item.requestedAt).toLocaleString('vi-VN')}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
          {item.requestStatus === 'pending'
            ? 'Đang chờ'
            : item.requestStatus === 'approved'
              ? 'Đã duyệt'
              : 'Từ chối'}
        </span>
      </div>
      <p className="text-sm text-slate-700">{item.note}</p>
      <p className="text-xs text-slate-500">
        Xin: {item.askVerified ? 'Đã xác thực' : ''}
        {item.askVerified && item.askTrusted ? ' · ' : ''}
        {item.askTrusted ? 'Nhà tuyển dụng uy tín' : ''}
        {!item.askVerified && !item.askTrusted ? '—' : ''}
        {' · '}Hiện có: {item.verified ? 'Đã xác thực' : 'chưa xác thực'}
        {item.trustedEmployer ? ' · uy tín' : ''}
      </p>
      {item.reviewNote ? <p className="text-xs text-slate-500">Phản hồi: {item.reviewNote}</p> : null}
      {pending && (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="accent-[#E8872A]" checked={verified} onChange={(e) => setVerified(e.target.checked)} />
            Cấp «Đã xác thực»
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="accent-[#E8872A]" checked={trusted} onChange={(e) => setTrusted(e.target.checked)} />
            Cấp «Nhà tuyển dụng uy tín»
          </label>
          <textarea
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#FFD0A3] focus:ring-2 focus:ring-[#FFD0A3]/40"
            rows={2}
            placeholder="Ghi chú cho NTD (tuỳ chọn)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              className="!rounded-xl !bg-[#072348] hover:!bg-[#0c3a72]"
              onClick={() =>
                onReview({
                  decision: 'approve',
                  verified,
                  trustedEmployer: trusted,
                  reviewNote: note || undefined,
                })
              }
            >
              Duyệt
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                onReview({ decision: 'reject', reviewNote: note || undefined })
              }
            >
              Từ chối
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
