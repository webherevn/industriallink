import type { Metadata } from 'next';
import { CrmFrame } from '@/components/crm-frame';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Gia hạn · CRM' };

const ROWS = [
  ['Amata', 'Gói tin', 'Còn 9 ngày', 'Credit còn 12%', 'Tạo deal gia hạn'],
  ['Yazaki', 'Khám phá', 'Chu kỳ còn 4 ngày', 'Đã dùng 1 tin', 'Gợi ý nâng gói'],
  ['Nidec', 'Gói Săn cơ bản', 'Còn 20 ngày', 'Còn 1 vị trí', 'Theo dõi'],
];

export default function CrmRenewalsPage() {
  return (
    <CrmFrame
      title="Gia hạn"
      description="Khách đang dùng inlink và sắp hết hạn gói hoặc sắp hết Credit. Sales bấm để mở một deal gia hạn, không đổi gói ngay trên màn này."
    >
      <ul className="space-y-3">
        {ROWS.map(([company, plan, time, credit, action]) => (
          <li key={company} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{company}</p>
              <p className="text-xs text-slate-500">{plan} · {time} · {credit}</p>
            </div>
            <span className="rounded-md bg-[#072348] px-3 py-1.5 text-xs font-semibold text-white">{action}</span>
          </li>
        ))}
      </ul>
    </CrmFrame>
  );
}
