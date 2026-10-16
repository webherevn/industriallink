import type { Metadata } from 'next';
import { Factory, Link2, Wallet } from 'lucide-react';
import { CrmCard, CrmCardGrid, CrmFrame } from '@/components/crm-frame';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Cộng tác viên · CRM' };

export default function CrmPartnersPage() {
  return (
    <CrmFrame
      kicker="Người giới thiệu khách"
      title="Khu cộng tác viên, hoa hồng để sau"
      description="Phần trăm hoa hồng sẽ cấu hình tại đây sau. Chưa trừ thuế và chưa khóa lead theo mã số thuế."
      placeholder="Tìm cộng tác viên hoặc mã giới thiệu"
      footnote="Hoa hồng chưa mở. Màn này chưa ghi dữ liệu."
    >
      <CrmCardGrid columns={3}>
        <CrmCard
          tone="indigo"
          icon={<Link2 className="h-5 w-5" />}
          title="Link giới thiệu"
          text="Mỗi cộng tác viên có một mã. Khách mở bảng giá qua link đó thì lead gắn về người đó."
        />
        <CrmCard
          tone="sky"
          icon={<Factory className="h-5 w-5" />}
          title="Khai báo nhà máy"
          text="Nhập tên công ty, mã số thuế và số điện thoại HR để giữ quyền giới thiệu."
        />
        <CrmCard
          tone="green"
          icon={<Wallet className="h-5 w-5" />}
          title="Ví hoa hồng"
          text="Hai số: đang chờ đối soát và có thể rút. Chưa có lệnh chi."
        />
      </CrmCardGrid>
    </CrmFrame>
  );
}
