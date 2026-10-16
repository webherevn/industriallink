import type { Metadata } from 'next';
import {
  Building2,
  CalendarClock,
  Kanban,
  NotebookPen,
  Phone,
  Receipt,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { CrmCard, CrmCardGrid, CrmChip, CrmFrame } from '@/components/crm-frame';
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
      kicker="Lead, deal đang chờ tiền và khách sắp hết gói"
      title="Bàn làm việc của đội kinh doanh"
      description="Mở một thẻ để xem việc cần xử lý. Số trên thẻ là mẫu để hình dung màn hình."
      placeholder="Tìm lead, deal hoặc nhà máy"
      chips={
        <>
          <CrmChip href="/crm/leads" icon={<Building2 className="h-4 w-4" />} label="Lead" />
          <CrmChip href="/crm/pipeline" icon={<Kanban className="h-4 w-4" />} label="Phễu bán gói" />
          <CrmChip href="/crm/activities" icon={<NotebookPen className="h-4 w-4" />} label="Nhật ký" />
          <CrmChip href="/crm/finance" icon={<Receipt className="h-4 w-4" />} label="Công nợ & VAT" />
          <CrmChip href="/crm/renewals" icon={<CalendarClock className="h-4 w-4" />} label="Gia hạn" />
          <CrmChip href="/crm/partners" icon={<Users className="h-4 w-4" />} label="Cộng tác viên" />
        </>
      }
    >
      <CrmCardGrid>
        <CrmCard
          tone="sky"
          badge="Mới"
          icon={<Building2 className="h-5 w-5" />}
          title="12 lead đang mở"
          text="Nhà máy chưa có người phụ trách hoặc đang được tư vấn gói."
        />
        <CrmCard
          tone="violet"
          icon={<Kanban className="h-5 w-5" />}
          title="7 deal đang chạy"
          text="Gói tin và gói Săn đang nằm trong phễu, chưa thu tiền."
        />
        <CrmCard
          tone="orange"
          badge="Mới"
          icon={<Wallet className="h-5 w-5" />}
          title="3 chờ thanh toán"
          text="Đã gửi báo giá. Chưa ghi nhận tiền về."
        />
        <CrmCard
          tone="green"
          icon={<CalendarClock className="h-5 w-5" />}
          title="5 sắp gia hạn"
          text="Gói hoặc Credit còn dưới 14 ngày."
        />
        <CrmCard
          tone="indigo"
          icon={<Sparkles className="h-5 w-5" />}
          title="Canon Việt Nam"
          text="Gói Doanh nghiệp · 48.000.000đ · chờ thanh toán."
          meta="Deal cần xử lý hôm nay"
        />
        <CrmCard
          tone="sky"
          icon={<Receipt className="h-5 w-5" />}
          title="VSIP Bắc Ninh"
          text="Gói Săn tiêu chuẩn · 18.000.000đ · đã gửi báo giá."
          meta="Deal cần xử lý hôm nay"
        />
        <CrmCard
          tone="green"
          icon={<Phone className="h-5 w-5" />}
          title="Gọi lại HR VSIP"
          text="Xác nhận nhu cầu tuyển kỹ sư bảo trì."
          meta="Hôm nay · 14:00"
        />
        <CrmCard
          tone="rose"
          icon={<CalendarClock className="h-5 w-5" />}
          title="Nhắc Credit Amata"
          text="Credit còn 12%. Nên mở deal gia hạn, chưa đổi gói."
          meta="Còn 9 ngày"
        />
      </CrmCardGrid>
    </CrmFrame>
  );
}
