import type { Metadata } from 'next';
import { Building2, CircleDot, Phone, UserRound } from 'lucide-react';
import { CrmCard, CrmCardGrid, CrmChip, CrmFrame } from '@/components/crm-frame';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Lead · CRM' };

export default function CrmLeadsPage() {
  return (
    <CrmFrame
      kicker="Nhà máy và người phụ trách HR"
      title="Lead chưa phải khách đã mua gói"
      description="Mỗi thẻ là một khách tiềm năng. Chưa gắn với công ty đã có tài khoản nhà tuyển dụng."
      placeholder="Tìm tên công ty, mã số thuế hoặc số điện thoại"
      chips={
        <>
          <CrmChip active icon={<CircleDot className="h-4 w-4" />} label="Tất cả · 3" />
          <CrmChip icon={<CircleDot className="h-4 w-4" />} label="Mới" />
          <CrmChip icon={<CircleDot className="h-4 w-4" />} label="Đang tư vấn" />
          <CrmChip icon={<CircleDot className="h-4 w-4" />} label="Đã có deal" />
        </>
      }
    >
      <CrmCardGrid columns={3}>
        <CrmCard
          tone="sky"
          badge="Mới"
          icon={<Building2 className="h-5 w-5" />}
          title="Công ty TNHH Canon VN"
          text="MST 0312345678 · HR Manager · 0903 123 456. Đang tư vấn gói tin."
          meta="LD-202610-01 · Phụ trách Lan"
        />
        <CrmCard
          tone="violet"
          icon={<Phone className="h-5 w-5" />}
          title="VSIP Bắc Ninh"
          text="MST 2300123456 · Trưởng HCNS · 0918 123 456. Mới vào danh sách."
          meta="LD-202610-02 · Phụ trách Minh"
        />
        <CrmCard
          tone="green"
          icon={<UserRound className="h-5 w-5" />}
          title="Amata"
          text="MST 3600987654 · Tuyển dụng · 0988 123 456. Đã mở một deal gói Săn."
          meta="LD-202610-03 · Phụ trách Lan"
        />
      </CrmCardGrid>
    </CrmFrame>
  );
}
