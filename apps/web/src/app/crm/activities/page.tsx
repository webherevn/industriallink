import type { Metadata } from 'next';
import { MapPin, MessageCircle, Phone } from 'lucide-react';
import { CrmCard, CrmCardGrid, CrmFrame } from '@/components/crm-frame';
import { NOINDEX_ROBOTS } from '@/lib/seo-robots';

export const metadata: Metadata = { robots: NOINDEX_ROBOTS, title: 'Nhật ký · CRM' };

export default function CrmActivitiesPage() {
  return (
    <CrmFrame
      kicker="Cuộc gọi, Zalo và buổi gặp"
      title="Nhật ký gắn với từng lead hoặc deal"
      description="Để biết ai đang chăm khách nào. Chưa ghi nhận cuộc gọi mới từ màn này."
      placeholder="Tìm theo nhà máy hoặc nội dung trao đổi"
    >
      <CrmCardGrid columns={3}>
        <CrmCard
          tone="green"
          badge="Mới"
          icon={<Phone className="h-5 w-5" />}
          title="Gọi điện · Canon Việt Nam"
          text="HR xác nhận sẽ chuyển khoản trong tuần."
          meta="Hôm nay · 09:20"
        />
        <CrmCard
          tone="sky"
          icon={<MessageCircle className="h-5 w-5" />}
          title="Zalo · VSIP Bắc Ninh"
          text="Đã gửi bảng giá gói tin và gói Săn."
          meta="Hôm qua · 16:05"
        />
        <CrmCard
          tone="orange"
          icon={<MapPin className="h-5 w-5" />}
          title="Gặp tại KCN · Amata"
          text="Họ cần shortlist kỹ sư bảo trì, chưa chốt gói."
          meta="12/10 · 11:00"
        />
      </CrmCardGrid>
    </CrmFrame>
  );
}
