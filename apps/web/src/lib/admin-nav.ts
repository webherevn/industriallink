import { UserRole } from '@industriallink/contracts';
import {
  BadgeCheck,
  BarChart3,
  Briefcase,
  Building2,
  Code2,
  FileText,
  FolderTree,
  ImageIcon,
  Home,
  LayoutDashboard,
  Menu,
  PanelBottom,
  Bot,
  ScrollText,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react';
import type { ComponentType } from 'react';

export type AdminNavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  soon?: boolean;
  /** Chỉ SuperAdmin thấy (mặc định: mọi CMS admin). */
  superAdminOnly?: boolean;
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
      { href: '/admin/homepage', label: 'SEO trang chủ', icon: Home },
    ],
  },
  {
    title: 'CMS & SEO',
    items: [
      { href: '/admin/categories', label: 'Danh mục', icon: FolderTree },
      { href: '/admin/posts', label: 'Bài viết', icon: FileText },
      { href: '/admin/pages', label: 'Trang', icon: FileText },
      { href: '/admin/author', label: 'Tác giả', icon: UserRound },
      { href: '/admin/media', label: 'Thư viện media', icon: ImageIcon },
    ],
  },
  {
    title: 'Cấu hình',
    items: [
      { href: '/admin/menus', label: 'Menu trang chủ', icon: Menu, superAdminOnly: true },
      { href: '/admin/footer', label: 'Chân trang', icon: PanelBottom, superAdminOnly: true },
      { href: '/admin/robots', label: 'Robots.txt', icon: Bot, superAdminOnly: true },
      {
        href: '/admin/site-code',
        label: 'Header & Footer code',
        icon: Code2,
        superAdminOnly: true,
      },
      { href: '/admin/redirects', label: 'Redirect 301', icon: Search },
    ],
  },
  {
    title: 'Nền tảng',
    items: [
      { href: '/admin/users', label: 'Người dùng', icon: Users, superAdminOnly: true },
      {
        href: '/admin/jobs',
        label: 'Tin tuyển dụng',
        icon: Briefcase,
        superAdminOnly: true,
      },
      {
        href: '/admin/moderation',
        label: 'Duyệt tin tuyển dụng',
        icon: ShieldCheck,
        superAdminOnly: true,
      },
      {
        href: '/admin/ai-settings',
        label: 'Cấu hình AI',
        icon: Sparkles,
        superAdminOnly: true,
      },
      { href: '/admin/companies', label: 'Công ty', icon: Building2, superAdminOnly: true },
      {
        href: '/admin/verification',
        label: 'Xác minh NTD',
        icon: BadgeCheck,
        superAdminOnly: true,
      },
      { href: '/admin/audit', label: 'Nhật ký', icon: ScrollText, superAdminOnly: true },
      { href: '/admin/reports', label: 'Báo cáo', icon: BarChart3, superAdminOnly: true },
    ],
  },
];

/** Nav theo vai trò: Biên tập viên không thấy Users / Menu / module nền tảng. */
export function adminNavForRole(role: UserRole | string | undefined): AdminNavSection[] {
  const isSuper = role === UserRole.SuperAdmin;
  return ADMIN_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => isSuper || !item.superAdminOnly),
  })).filter((section) => section.items.length > 0);
}
