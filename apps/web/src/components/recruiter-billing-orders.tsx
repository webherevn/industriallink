'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, CheckCircle2, Coins, CreditCard, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { RecruiterShell } from '@/components/recruiter-shell';
import { Button, Card } from '@/components/ui';
import { fetchRecruiterOrders } from '@/lib/recruiter-billing';

const STATUS_LABEL: Record<string, { label: string; tone: 'ok' | 'pending' | 'failed' | 'neutral' }> = {
  pending: { label: 'Đang chờ', tone: 'pending' },
  paid: { label: 'Đã thanh toán', tone: 'ok' },
  failed: { label: 'Thất bại', tone: 'failed' },
  refunded: { label: 'Đã hoàn', tone: 'neutral' },
};

export function RecruiterOrders() {
  const { data, isLoading } = useQuery({
    queryKey: ['recruiter-orders'],
    queryFn: fetchRecruiterOrders,
  });

  return (
    <RecruiterShell>
      <div className="recruiter-dash space-y-6">
        <div>
          <Link
            href="/recruiter/billing/topup"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-3 w-3" /> Quay lại Top-up
          </Link>
          <h1 className="cms-page-title mt-2">Lịch sử đơn mua Credit</h1>
          <div className="brand-accent-bar mt-2" />
          <p className="cms-page-subtitle mt-2">
            Tất cả đơn Top-up và trạng thái thanh toán. Đơn &quot;Đã thanh toán&quot; đã được cấp credit tự động.
          </p>
        </div>

        {isLoading ? (
          <div className="recruiter-dash-skel h-64" />
        ) : !data || data.items.length === 0 ? (
          <Card className="p-8 text-center text-sm text-slate-500">
            <CreditCard className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3">Chưa có đơn mua Credit nào.</p>
            <Link href="/recruiter/billing/topup" className="mt-3 inline-block">
              <Button>Mua ngay</Button>
            </Link>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Mã đơn</th>
                    <th className="px-4 py-3">Credit</th>
                    <th className="px-4 py-3">Số tiền</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Ngày tạo</th>
                    <th className="px-4 py-3">Thanh toán lúc</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((o) => {
                    const s = STATUS_LABEL[o.status] ?? { label: o.status, tone: 'neutral' as const };
                    return (
                      <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-700">{o.id.slice(0, 8)}…</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-900">
                            <Coins className="h-3.5 w-3.5 text-accent-600" /> +{o.creditCountSnapshot}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold">
                          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(o.priceVndSnapshot))}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={s.tone} label={s.label} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {new Date(o.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {o.paidAt ? new Date(o.paidAt).toLocaleString('vi-VN') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        <p className="text-[11px] text-slate-400">
          Tổng: {data?.total ?? 0} đơn
        </p>
      </div>
    </RecruiterShell>
  );
}

function StatusBadge({
  status,
  label,
}: {
  status: 'ok' | 'pending' | 'failed' | 'neutral';
  label: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
        status === 'ok' && 'bg-emerald-100 text-emerald-700',
        status === 'pending' && 'bg-amber-100 text-amber-700',
        status === 'failed' && 'bg-rose-100 text-rose-700',
        status === 'neutral' && 'bg-slate-100 text-slate-700',
      )}
    >
      {status === 'ok' ? <CheckCircle2 className="h-3 w-3" /> : null}
      {status === 'failed' ? <XCircle className="h-3 w-3" /> : null}
      {status === 'pending' ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
      {label}
    </span>
  );
}
