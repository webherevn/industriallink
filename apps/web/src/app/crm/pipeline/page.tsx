import type { Metadata } from 'next';
import { CrmFrame } from '@/components/crm-frame';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Phễu bán gói · CRM' };

const COLUMNS = [
  { name: 'Lead mới', cards: [{ company: 'VSIP Bắc Ninh', plan: 'Chưa chọn gói', price: '—' }] },
  { name: 'Đã tư vấn', cards: [{ company: 'Samsung Electro', plan: 'Gói tin năm', price: '12.000.000đ' }] },
  { name: 'Đã gửi báo giá', cards: [{ company: 'Amata', plan: 'Gói Săn tiêu chuẩn', price: '18.000.000đ' }] },
  { name: 'Chờ thanh toán', cards: [{ company: 'Canon Việt Nam', plan: 'Gói Doanh nghiệp', price: '48.000.000đ' }] },
  { name: 'Đã chốt', cards: [{ company: 'Yazaki', plan: 'Gói tin', price: 'Đã thu' }] },
  { name: 'Không chốt', cards: [{ company: 'Nidec', plan: 'Gói Săn', price: 'Hoãn tuyển' }] },
];

export default function CrmPipelinePage() {
  return (
    <CrmFrame
      title="Phễu bán gói"
      description="Một phễu cho gói tin và gói Săn đang bán. Thẻ ở cột Đã chốt chỉ là trạng thái kinh doanh, không tự bật gói trên tài khoản nhà tuyển dụng."
    >
      <div className="grid gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {COLUMNS.map((column) => (
          <section key={column.name} className="rounded-xl border border-slate-200 bg-white p-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{column.name}</h2>
            <div className="mt-3 space-y-2">
              {column.cards.map((card) => (
                <article key={card.company} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">{card.company}</p>
                  <p className="mt-1 text-xs text-slate-500">{card.plan}</p>
                  <p className="mt-2 text-sm font-semibold text-[#072348]">{card.price}</p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </CrmFrame>
  );
}
