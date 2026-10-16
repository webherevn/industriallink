import type { Metadata } from 'next';
import { Building2 } from 'lucide-react';
import { CrmFrame } from '@/components/crm-frame';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Phễu bán gói · CRM' };

const COLUMNS: {
  name: string;
  tone: string;
  cards: { company: string; plan: string; price: string; fresh?: boolean }[];
}[] = [
  {
    name: 'Lead mới',
    tone: 'bg-sky-50 text-sky-600',
    cards: [{ company: 'VSIP Bắc Ninh', plan: 'Chưa chọn gói', price: '—' }],
  },
  {
    name: 'Đã tư vấn',
    tone: 'bg-violet-50 text-violet-600',
    cards: [{ company: 'Samsung Electro', plan: 'Gói tin năm', price: '12.000.000đ' }],
  },
  {
    name: 'Đã gửi báo giá',
    tone: 'bg-indigo-50 text-indigo-600',
    cards: [{ company: 'Amata', plan: 'Gói Săn tiêu chuẩn', price: '18.000.000đ' }],
  },
  {
    name: 'Chờ thanh toán',
    tone: 'bg-orange-50 text-orange-500',
    cards: [{ company: 'Canon Việt Nam', plan: 'Gói Doanh nghiệp', price: '48.000.000đ', fresh: true }],
  },
  {
    name: 'Đã chốt',
    tone: 'bg-emerald-50 text-emerald-600',
    cards: [{ company: 'Yazaki', plan: 'Gói tin · chưa bật gói NTD', price: 'Đã thu' }],
  },
  {
    name: 'Không chốt',
    tone: 'bg-rose-50 text-rose-500',
    cards: [{ company: 'Nidec', plan: 'Gói Săn', price: 'Hoãn tuyển' }],
  },
];

export default function CrmPipelinePage() {
  return (
    <CrmFrame
      kicker="Một phễu cho gói tin và gói Săn"
      title="Theo deal từ lúc chào đến lúc thu tiền"
      description="Cột Đã chốt chỉ là trạng thái kinh doanh. Gói trên tài khoản nhà tuyển dụng không tự bật từ cột này."
      placeholder="Tìm deal theo tên nhà máy hoặc tên gói"
    >
      <div className="-mx-1 flex gap-3 overflow-x-auto pb-2">
        {COLUMNS.map((column) => (
          <section key={column.name} className="w-[230px] shrink-0 rounded-[22px] bg-white/70 p-3 shadow-[0_8px_24px_rgba(91,76,219,0.05)]">
            <h2 className="px-1 text-xs font-semibold text-slate-500">{column.name}</h2>
            <div className="mt-3 space-y-2">
              {column.cards.map((card) => (
                <article key={card.company} className="relative rounded-2xl bg-white p-3.5 shadow-sm">
                  {card.fresh ? (
                    <span className="absolute right-3 top-3 rounded-full bg-[#ff4d4f] px-1.5 py-0.5 text-[10px] font-bold text-white">
                      Mới
                    </span>
                  ) : null}
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${column.tone}`}>
                    <Building2 className="h-4 w-4" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-900">{card.company}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{card.plan}</p>
                  <p className="mt-2 text-sm font-semibold text-[#4c3ec9]">{card.price}</p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </CrmFrame>
  );
}
