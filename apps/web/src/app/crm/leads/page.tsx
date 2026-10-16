import type { Metadata } from 'next';
import { CrmFrame } from '@/components/crm-frame';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Lead · CRM' };

const ROWS = [
  ['LD-202610-01', 'Công ty TNHH Canon VN', '0312345678', '0903123456', 'HR Manager', 'Đang tư vấn', 'Lan'],
  ['LD-202610-02', 'VSIP Bắc Ninh', '2300123456', '0918123456', 'Trưởng HCNS', 'Mới', 'Minh'],
  ['LD-202610-03', 'Amata', '3600987654', '0988123456', 'Tuyển dụng', 'Đã có deal', 'Lan'],
];

export default function CrmLeadsPage() {
  return (
    <CrmFrame
      title="Lead"
      description="Nhà máy và người phụ trách HR. Mỗi dòng là một khách tiềm năng, chưa phải công ty đã mua gói."
    >
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">Danh sách</p>
          <span className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500">
            Thêm lead
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                {['Mã', 'Công ty', 'MST', 'Điện thoại', 'Liên hệ', 'Trạng thái', 'Phụ trách'].map((head) => (
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
