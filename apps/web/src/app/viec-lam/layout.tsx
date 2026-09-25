import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Việc làm công nghiệp B2B | inlink',
  description:
    'Tìm việc kỹ sư kinh doanh, kỹ thuật, M&E, tự động hóa. Kết quả tìm kiếm việc làm công nghiệp trên inlink.',
};

export default function ViecLamLayout({ children }: { children: ReactNode }) {
  return children;
}

