import type { Metadata } from 'next';
import { CrmFrame, CrmStat } from '@/components/crm-frame';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
  title: 'CRM inlink',
};

export default function CrmHomePage() {
  return (
    <CrmFrame
      title="Bàn làm việc"
      description="Một màn hình để thấy lead mới, deal đang chờ thanh toán và khách sắp hết gói."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CrmStat label="Lead mở" value="12" hint="Chưa có người phụ trách hoặc đang tư vấn" />
        <CrmStat label="Deal đang chạy" value="7" hint="Trong phễu bán gói tin và gói Săn" />
        <CrmStat label="Chờ thanh toán" value="3" hint="Đã báo giá, chưa thu tiền" />
        <CrmStat label="Sắp gia hạn" value="5" hint="Gói hoặc Credit còn dưới 14 ngày" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-xl border border-slate-200 bg-white">
          <header className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Deal cần xử lý hôm nay</h2>
          </header>
          <ul className="divide-y divide-slate-100">
            {[
              ['Canon Việt Nam', 'Gói Doanh nghiệp', 'Chờ thanh toán', '48.000.000đ'],
              ['VSIP Bắc Ninh', 'Gói Săn tiêu chuẩn', 'Đã gửi báo giá', '18.000.000đ'],
              ['Samsung Electro', 'Gói tin năm', 'Đã tư vấn', '12.000.000đ'],
            ].map(([company, plan, stage, price]) => (
              <li key={company} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{company}</p>
                  <p className="text-xs text-slate-500">{plan}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-[#072348]">{price}</p>
                  <p className="text-[11px] text-slate-500">{stage}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white">
          <header className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Việc sắp tới</h2>
          </header>
          <ul className="space-y-3 px-4 py-3 text-sm">
            <li className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="font-medium text-slate-800">Gọi lại HR VSIP</p>
              <p className="text-xs text-slate-500">Hôm nay · 14:00 · Lead</p>
            </li>
            <li className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="font-medium text-slate-800">Gửi báo giá gói Săn</p>
              <p className="text-xs text-slate-500">Ngày mai · Deal</p>
            </li>
            <li className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="font-medium text-slate-800">Nhắc gia hạn Credit</p>
              <p className="text-xs text-slate-500">Còn 9 ngày · Công ty Amata</p>
            </li>
          </ul>
        </section>
      </div>
    </CrmFrame>
  );
}
