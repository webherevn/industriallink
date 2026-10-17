'use client';

import { Building2, CalendarClock, FileText, Kanban, PieChart, Users } from 'lucide-react';
import Link from 'next/link';
import { CrmCard, CrmCardGrid, CrmFrame } from '@/components/crm-frame';

const CARDS = [
  {
    href: '/crm/reports',
    tone: 'indigo' as const,
    icon: <PieChart className="h-5 w-5" />,
    title: 'Doanh số',
    text: 'Tiền khách đã trả trong tháng, theo người phụ trách, nguồn và cộng tác viên. Tách gói tin với gói Săn.',
  },
  {
    href: '/crm/bao-cao/pheu',
    tone: 'violet' as const,
    icon: <Kanban className="h-5 w-5" />,
    title: 'Phễu cơ hội',
    text: 'Số cơ hội và giá niêm yết theo giai đoạn. Ngày kỳ vọng trong tháng là dự kiến, không phải doanh số.',
  },
  {
    href: '/crm/bao-cao/nguon',
    tone: 'sky' as const,
    icon: <Building2 className="h-5 w-5" />,
    title: 'Nguồn tiềm năng',
    text: 'Lead mới trong tháng theo nguồn và người phụ trách, kèm công ty đã trả gói sau đó.',
  },
  {
    href: '/crm/bao-cao/bao-gia',
    tone: 'orange' as const,
    icon: <FileText className="h-5 w-5" />,
    title: 'Báo giá',
    text: 'Tờ bản thảo và đã gửi. Phương án 1 và phương án 2 để riêng. Có đếm tờ sau đó có đơn đã trả.',
  },
  {
    href: '/crm/bao-cao/gia-han',
    tone: 'green' as const,
    icon: <CalendarClock className="h-5 w-5" />,
    title: 'Gia hạn',
    text: 'Gói hết hạn trong tháng: sắp hết, đã hết, hoặc đã có đơn trả tiếp.',
  },
  {
    href: '/crm/bao-cao/cong-tac-vien',
    tone: 'rose' as const,
    icon: <Users className="h-5 w-5" />,
    title: 'Cộng tác viên',
    text: 'Đơn đã trả gắn mã giới thiệu. Tiền là khách đã trả. Hoa hồng nằm ở mục tài chính.',
  },
];

export function CrmBusinessReportsPanel() {
  return (
    <CrmFrame
      kicker="Các báo cáo kinh doanh"
      title="Báo cáo"
      description="Mỗi báo cáo mở riêng. Doanh số là tiền khách đã trả. Giá trên phễu và báo giá là niêm yết, chưa VAT."
      footnote="Báo cáo marketing để sau, khi được yêu cầu tiếp."
    >
      <CrmCardGrid columns={3}>
        {CARDS.map((card) => (
          <Link key={card.href} href={card.href} className="block h-full">
            <CrmCard tone={card.tone} icon={card.icon} title={card.title} text={card.text} />
          </Link>
        ))}
      </CrmCardGrid>
    </CrmFrame>
  );
}
