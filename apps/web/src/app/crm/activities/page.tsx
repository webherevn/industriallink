import type { Metadata } from 'next';
import { CrmFrame } from '@/components/crm-frame';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Nhật ký · CRM' };

const ITEMS = [
  ['Hôm nay · 09:20', 'Gọi điện', 'Canon Việt Nam', 'HR xác nhận sẽ chuyển khoản trong tuần.'],
  ['Hôm qua · 16:05', 'Zalo', 'VSIP Bắc Ninh', 'Gửi bảng giá gói tin và gói Săn.'],
  ['12/10 · 11:00', 'Gặp tại KCN', 'Amata', 'Họ cần shortlist kỹ sư bảo trì, chưa chốt gói.'],
];

export default function CrmActivitiesPage() {
  return (
    <CrmFrame
      title="Nhật ký chăm sóc"
      description="Cuộc gọi, Zalo và buổi gặp gắn với một lead hoặc một deal. Dùng để biết ai đang chăm khách nào."
    >
      <ol className="space-y-3">
        {ITEMS.map(([time, kind, company, note]) => (
          <li key={time} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">{kind}</span>
              <span className="text-sm font-semibold text-slate-900">{company}</span>
              <span className="text-xs text-slate-400">{time}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{note}</p>
          </li>
        ))}
      </ol>
    </CrmFrame>
  );
}
