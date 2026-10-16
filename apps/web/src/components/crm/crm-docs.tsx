'use client';

import { AdminDocs } from '@/components/admin-docs';
import { CRM_DOC_GROUPS } from '@/lib/crm-docs-content';

export function CrmDocs() {
  return (
    <AdminDocs
      groups={CRM_DOC_GROUPS}
      title="Tài liệu CRM inlink"
      description="Giải thích từng mục trên CRM: chức năng, luồng chạy và những gì đã làm. Nội dung bám đúng cách hệ thống đang vận hành."
      searchPlaceholder="Tìm trong tài liệu: lead, báo giá, hoa hồng, VAT…"
    />
  );
}
