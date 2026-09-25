import {
  BarChart3,
  Briefcase,
  Building2,
  FileText,
  FolderTree,
  LayoutDashboard,
  Search,
  Users,
} from 'lucide-react';
import type { ComponentType } from 'react';

export type AdminNavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  soon?: boolean;
};

export type AdminNavSection = {
  title: string;
  items: AdminNavItem[];
};

/** Registry module — thêm mục mới ở đây khi mở rộng Superadmin. */
export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    title: 'Tổng quan',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/admin/seo', label: 'SEO overview', icon: Search },
    ],
  },
  {
    title: 'CMS & SEO',
    items: [
      { href: '/admin/categories', label: 'Danh mục', icon: FolderTree },
      { href: '/admin/posts', label: 'Bài viết', icon: FileText },
      { href: '/admin/pages', label: 'Trang', icon: FileText },
    ],
  },
  {
    title: 'Nền tảng',
    items: [
      { href: '#', label: 'Người dùng', icon: Users, soon: true },
      { href: '#', label: 'Tin tuyển dụng', icon: Briefcase, soon: true },
      { href: '#', label: 'Công ty', icon: Building2, soon: true },
      { href: '#', label: 'Báo cáo', icon: BarChart3, soon: true },
    ],
  },
];
