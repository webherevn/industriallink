import type { Metadata } from 'next';
import { CrmFrame } from '@/components/crm-frame';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Cộng tác viên · CRM' };

export default function CrmPartnersPage() {
  return (
    <CrmFrame
      title="Cộng tác viên"
      description="Khu riêng cho người giới thiệu khách. Phần trăm hoa hồng sẽ cấu hình tại đây sau, chưa trừ thuế và chưa khóa lead."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {[
          ['Link giới thiệu', 'Mỗi CTV có một mã. Khách mở bảng giá qua link đó thì lead gắn về CTV.'],
          ['Khai báo nhà máy', 'CTV nhập tên công ty, mã số thuế và số điện thoại HR để giữ quyền giới thiệu.'],
          ['Ví hoa hồng', 'Hai số: đang chờ đối soát và có thể rút. Chưa có lệnh chi.'],
        ].map(([title, text]) => (
          <section key={title} className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-[#072348]">{title}</h2>
            <p className="mt-2 text-sm text-slate-500">{text}</p>
          </section>
        ))}
      </div>
    </CrmFrame>
  );
}
