'use client';

import { PieChart } from 'lucide-react';
import Link from 'next/link';
import { CrmCard, CrmCardGrid, CrmFrame } from '@/components/crm-frame';

export function CrmBusinessReportsPanel() {
  return (
    <CrmFrame
      kicker="Các báo cáo kinh doanh"
      title="Báo cáo"
      description="Mỗi báo cáo mở riêng. Doanh số là tiền khách đã trả trong tháng. Bước Đã chốt không được tính."
      footnote="Báo cáo marketing để sau, khi được yêu cầu tiếp."
    >
      <CrmCardGrid columns={3}>
        <Link href="/crm/reports" className="block h-full">
          <CrmCard
            tone="indigo"
            icon={<PieChart className="h-5 w-5" />}
            title="Doanh số"
            text="Một tháng theo người phụ trách, nguồn và cộng tác viên. Tách gói tin với gói Săn."
          />
        </Link>
      </CrmCardGrid>
    </CrmFrame>
  );
}
