'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { CtvShell } from '@/components/ctv-shell';
import { consumeHandoffToken } from '@/lib/api';

/**
 * Layout của Cổng Cộng tác viên: Sidebar trái + Topbar + vùng nội dung.
 * Đọc token SSO (#il_at=...) rồi dọn khỏi thanh địa chỉ trình duyệt.
 */
export default function CtvLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    consumeHandoffToken();
  }, []);

  // Trang đăng nhập CTV dùng bố cục riêng (không sidebar).
  if (pathname === '/ctv/login') return <>{children}</>;

  return <CtvShell>{children}</CtvShell>;
}
