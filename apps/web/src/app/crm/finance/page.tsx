import type { Metadata } from 'next';
import { CrmFrame } from '@/components/crm-frame';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Công nợ & VAT · CRM' };

const ROWS = [
  ['DL-2610', 'Canon Việt Nam', '48.000.000đ', 'Chưa VAT', 'Chưa xuất', 'Chờ thanh toán'],
  ['DL-2608', 'Yazaki', '9.000.000đ', '10%', 'Đã xuất', 'Đã thu'],
  ['DL-2604', 'Amata', '18.000.000đ', '10%', 'Chờ xuất', 'Thu một phần'],
];

export default function CrmFinancePage() {
  return (
    <CrmFrame
      title="Công nợ và hóa đơn VAT"
      description="Giá trên bảng giá là giá chưa VAT. Màn này để kế toán thấy còn thiếu bao nhiêu và hóa đơn đã xuất chưa. Chưa tính hoa hồng."
    >
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                {['Deal', 'Khách', 'Giá niêm yết', 'VAT', 'Hóa đơn', 'Thu tiền'].map((head) => (
                  <th key={head} className="px-4 py-3">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row[0]} className="border-t border-slate-100">
                  {row.map((cell) => (
                    <td key={cell} className="px-4 py-3 text-slate-700">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </CrmFrame>
  );
}
