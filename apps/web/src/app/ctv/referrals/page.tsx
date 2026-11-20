'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Loader2, UserCheck, Users } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { formatVnd } from '@/components/crm/format';
import { fetchMyPartner } from '@/lib/crm';

type Tab = 'unpaid' | 'paid';

export default function CtvReferralsPage() {
  const mine = useQuery({ queryKey: ['recruiter-partner'], queryFn: fetchMyPartner });
  const [tab, setTab] = useState<Tab>('unpaid');

  const partner = mine.data?.partner ?? null;
  const entries = mine.data?.commissions ?? [];
  const signups = partner?.signups ?? [];

  // Đơn đã thanh toán gói = dòng hoa hồng đã ghi.
  const paidCompanies = entries.map((entry) => ({
    id: entry.id,
    companyName: entry.companyName,
    planName: entry.planName,
    orderKind: entry.orderKind,
    commissionVnd: entry.commissionVnd,
    paidAmountVnd: entry.paidAmountVnd,
    paidAt: entry.paidAt,
  }));

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#0F2440]">Khách hàng giới thiệu</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Khách đăng ký qua link của bạn được ghi nhận trong 14 ngày. Hoa hồng chỉ ghi khi họ
              thanh toán gói có giá.
            </p>
          </div>
          <div className="flex gap-1">
            {(
              [
                ['unpaid', `Đã đăng ký, chưa thanh toán (${signups.length})`],
                ['paid', `Đã thanh toán gói (${paidCompanies.length})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={clsx(
                  'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                  tab === id
                    ? 'bg-[#0F2440] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {mine.isLoading ? (
          <p className="flex items-center gap-2 px-5 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tải danh sách khách hàng…
          </p>
        ) : tab === 'unpaid' ? (
          signups.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title="Chưa có khách hàng đăng ký"
              body="Chép link giới thiệu và gửi cho khách hàng B2B. Khách mở link sẽ được ghi nhận trong 14 ngày."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {signups.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {row.companyName}
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-slate-500">
                      Đăng ký {formatDate(row.registeredAt)} · còn {daysLeft(row.registeredAt)} ngày
                      trong hạn cookie
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                    Chưa thanh toán
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : paidCompanies.length === 0 ? (
          <EmptyState
            icon={<UserCheck className="h-8 w-8" />}
            title="Chưa có đơn đã thanh toán"
            body="Khi khách hàng thanh toán gói Tin đăng hoặc Gói Săn, hoa hồng sẽ xuất hiện ở đây."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {paidCompanies.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{row.companyName}</p>
                  <p className="mt-0.5 truncate text-xs leading-snug text-slate-500">
                    {row.orderKind === 'sourcing' ? 'Gói Săn' : 'Gói tin'}
                    {row.planName ? ` · ${row.planName}` : ''} · Đơn {formatVnd(row.paidAmountVnd)} ·
                    Thanh toán {formatDate(row.paidAt)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-[#0F2440]">
                  +{formatVnd(row.commissionVnd)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm font-semibold text-blue-900">
          Mẹo chốt đơn trong 14 ngày
        </p>
        <p className="mt-1 text-sm leading-relaxed text-blue-800">
          Cookie giới thiệu giữ 14 ngày kể từ lần bấm đầu tiên. Trong hạn này khách thanh toán gói
          thì bạn nhận hoa hồng — kể cả khi họ bấm lại link của CTV khác thì mã của bạn vẫn được
          giữ. Ngoài 14 ngày thì mã CTV khác có hiệu lực.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-3 h-9 px-3 py-1.5 text-[13px]"
          onClick={() => {
            window.location.href = '/ctv/links';
          }}
        >
          Lấy link giới thiệu
        </Button>
      </section>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col items-center px-5 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        {icon}
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-500">{body}</p>
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

/** Số ngày còn lại trong hạn cookie 14 ngày. */
function daysLeft(iso: string): number {
  const elapsed = Date.now() - new Date(iso).getTime();
  const left = 14 - Math.floor(elapsed / (24 * 60 * 60 * 1000));
  return left > 0 ? left : 0;
}
