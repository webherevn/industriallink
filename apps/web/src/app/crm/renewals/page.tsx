import type { Metadata } from 'next';
import { CalendarClock, Sparkles, Timer } from 'lucide-react';
import { CrmCard, CrmCardGrid, CrmFrame } from '@/components/crm-frame';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Gia hạn · CRM' };

export default function CrmRenewalsPage() {
  return (
    <CrmFrame
      kicker="Khách đang dùng inlink"
      title="Ai sắp hết gói hoặc hết Credit"
      description="Sales sẽ mở một deal gia hạn từ đây. Màn này không đổi gói trên tài khoản nhà tuyển dụng."
      placeholder="Tìm nhà máy sắp hết hạn"
    >
      <CrmCardGrid columns={3}>
        <CrmCard
          tone="rose"
          badge="Mới"
          icon={<CalendarClock className="h-5 w-5" />}
          title="Amata · Gói tin"
          text="Còn 9 ngày. Credit còn 12%. Việc tiếp theo: tạo deal gia hạn."
        />
        <CrmCard
          tone="orange"
          icon={<Sparkles className="h-5 w-5" />}
          title="Yazaki · Khám phá"
          text="Chu kỳ còn 4 ngày. Đã dùng 1 tin. Việc tiếp theo: gợi ý nâng gói."
        />
        <CrmCard
          tone="violet"
          icon={<Timer className="h-5 w-5" />}
          title="Nidec · Gói Săn cơ bản"
          text="Còn 20 ngày. Còn 1 vị trí. Việc tiếp theo: theo dõi."
        />
      </CrmCardGrid>
    </CrmFrame>
  );
}
