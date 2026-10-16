import type { Metadata } from 'next';
import { FileCheck2, FileClock, Receipt } from 'lucide-react';
import { CrmCard, CrmCardGrid, CrmFrame } from '@/components/crm-frame';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Công nợ & VAT · CRM' };

export default function CrmFinancePage() {
  return (
    <CrmFrame
      kicker="Giá niêm yết là giá chưa VAT"
      title="Công nợ và hóa đơn cần theo dõi"
      description="Kế toán thấy còn thiếu bao nhiêu và hóa đơn đã xuất chưa. Chưa tính hoa hồng."
      placeholder="Tìm deal hoặc tên khách"
    >
      <CrmCardGrid columns={3}>
        <CrmCard
          tone="orange"
          badge="Mới"
          icon={<Receipt className="h-5 w-5" />}
          title="Canon Việt Nam · 48.000.000đ"
          text="Chưa VAT · hóa đơn chưa xuất · đang chờ thanh toán."
          meta="Deal DL-2610"
        />
        <CrmCard
          tone="green"
          icon={<FileCheck2 className="h-5 w-5" />}
          title="Yazaki · 9.000.000đ"
          text="VAT 10% · hóa đơn đã xuất · đã thu đủ."
          meta="Deal DL-2608"
        />
        <CrmCard
          tone="violet"
          icon={<FileClock className="h-5 w-5" />}
          title="Amata · 18.000.000đ"
          text="VAT 10% · hóa đơn chờ xuất · thu một phần."
          meta="Deal DL-2604"
        />
      </CrmCardGrid>
    </CrmFrame>
  );
}
