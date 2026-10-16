'use client';

import { useQuery } from '@tanstack/react-query';
import type { CrmPartnerView } from '@industriallink/contracts';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CrmEmpty, CrmFrame } from '@/components/crm-frame';
import { formatWhen, matchesQuery } from '@/components/crm/format';
import { fetchCrmPartners } from '@/lib/crm';

export function CrmSignupsPanel({ initialQuery = '' }: { initialQuery?: string }) {
  const partners = useQuery({ queryKey: ['crm-partners'], queryFn: fetchCrmPartners });
  const [query, setQuery] = useState(initialQuery);
  const all = useMemo(() => flattenSignups(partners.data ?? []), [partners.data]);
  const rows = all.filter((row) => matchesQuery(query, [row.companyName, row.partnerName, row.partnerCode]));

  return (
    <CrmFrame
      kicker="Tài khoản mở link cộng tác viên"
      title="Đã đăng ký, chưa thanh toán"
      description="Nhà tuyển dụng tạo tài khoản trong hạn cookie. Hoa hồng chỉ ghi khi họ thanh toán gói tin hoặc gói Săn có giá."
      placeholder="Tìm công ty, cộng tác viên hoặc mã"
      search={{ value: query, onChange: setQuery }}
      footnote="Danh sách này không tạo đơn, không bật gói và không đổi cột phễu."
    >
      {partners.isLoading ? <CrmEmpty>Đang tải đăng ký…</CrmEmpty> : null}
      {partners.isError ? <CrmEmpty>Không tải được danh sách đăng ký.</CrmEmpty> : null}
      {partners.data && all.length === 0 ? (
        <CrmEmpty>Chưa có nhà tuyển dụng nào đăng ký qua mã mà chưa thanh toán.</CrmEmpty>
      ) : null}
      {partners.data && all.length > 0 && rows.length === 0 ? (
        <CrmEmpty>Không có dòng khớp từ khóa.</CrmEmpty>
      ) : null}
      {rows.length > 0 ? (
        <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_10px_28px_rgba(91,76,219,0.07)]">
          <p className="border-b border-slate-100 px-4 py-3 text-sm text-slate-500">{rows.length} tài khoản đang hiện.</p>
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => (
              <li key={row.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
                <p className="truncate text-sm font-medium text-slate-900">{row.companyName}</p>
                <p className="truncate text-sm text-slate-600">
                  <Link href={`/crm/partners?q=${encodeURIComponent(row.partnerCode)}`} className="font-medium text-[#4c3ec9] underline">
                    {row.partnerCode}
                  </Link>
                  <span> · {row.partnerName}</span>
                </p>
                <p className="text-xs text-slate-500 sm:text-right">{formatWhen(row.registeredAt)}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </CrmFrame>
  );
}

function flattenSignups(partners: CrmPartnerView[]) {
  return partners
    .flatMap((partner) =>
      partner.signups.map((signup) => ({
        id: signup.id,
        companyName: signup.companyName,
        registeredAt: signup.registeredAt,
        partnerName: partner.name,
        partnerCode: partner.code,
      })),
    )
    .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt));
}
