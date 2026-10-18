'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  BadgePercent,
  BarChart3,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CircleDollarSign,
  CirclePercent,
  Contact,
  FileText,
  Flag,
  Kanban,
  Megaphone,
  Radio,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  NotebookPen,
  Percent,
  Receipt,
  Scale,
  ShoppingBag,
  UserPlus,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { isCrmRole, UserRole } from '@industriallink/contracts';
import { BrandSidebarLockup } from '@/components/brand-logo';
import { CrmTopbar } from '@/components/crm/topbar';
import { restoreSession, tokenStore } from '@/lib/api';
import { fetchMe, logout } from '@/lib/auth';
import { bounceIfWrongHost, goToPublicApp } from '@/lib/hosts';

const NAV = [
  {
    title: 'Tổng quan',
    items: [{ href: '/crm', label: 'Bàn làm việc', icon: LayoutDashboard }],
  },
  {
    title: 'Kinh doanh',
    items: [
      { href: '/crm/leads', label: 'Tiềm năng', icon: Building2 },
      { href: '/crm/customers', label: 'Khách hàng', icon: Contact },
      { href: '/crm/pipeline', label: 'Cơ hội', icon: Kanban },
      { href: '/crm/quotes', label: 'Báo giá', icon: FileText },
      { href: '/crm/orders', label: 'Đơn hàng', icon: ShoppingBag },
      { href: '/crm/bao-cao', label: 'Báo cáo', icon: BarChart3 },
    ],
  },
  {
    title: 'Chăm sóc',
    items: [
      { href: '/crm/activities', label: 'Nhật ký', icon: NotebookPen },
      { href: '/crm/renewals', label: 'Gia hạn', icon: CalendarClock },
    ],
  },
  {
    title: 'Tài chính',
    items: [
      { href: '/crm/finance', label: 'Hóa đơn', icon: Receipt },
      { href: '/crm/finance/reconciliation', label: 'Đối soát', icon: Scale },
      { href: '/crm/finance/periods', label: 'Kỳ chốt', icon: CalendarCheck },
      { href: '/crm/finance/accounting', label: 'Kế toán', icon: Landmark },
    ],
  },
  {
    title: 'Tăng trưởng',
    items: [
      { href: '/crm/partners', label: 'Cộng tác viên', icon: Users },
      { href: '/crm/signups', label: 'Đăng ký chưa trả', icon: UserPlus },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { href: '/crm/marketing', label: 'Tổng quan', icon: Megaphone },
      { href: '/crm/marketing/campaigns', label: 'Chiến dịch', icon: Flag },
      { href: '/crm/marketing/channels', label: 'Kênh', icon: Radio },
      { href: '/crm/marketing/costs', label: 'Chi phí', icon: CircleDollarSign },
    ],
  },
  {
    title: 'Cài đặt',
    items: [
      { href: '/crm/settings/profile', label: 'Hồ sơ', icon: UserRound },
      { href: '/crm/settings/staff', label: 'Nhân sự', icon: Users },
      { href: '/crm/settings/commission', label: 'Hoa hồng', icon: Percent },
      { href: '/crm/settings/payout-day', label: 'Ngày chi', icon: CalendarDays },
      { href: '/crm/settings/vat', label: 'Thuế suất', icon: CirclePercent },
    ],
  },
  {
    title: 'Tài liệu',
    items: [{ href: '/crm/docs', label: 'Documents (Tài liệu)', icon: BookOpen }],
  },
] as const;

export function CrmShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    void restoreSession().finally(() => setSessionReady(true));
  }, []);

  const hasToken = sessionReady && Boolean(tokenStore.get());
  const { data: user, isError, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: hasToken,
  });

  useEffect(() => {
    if (!sessionReady) return;
    if (!tokenStore.get()) router.replace('/login');
  }, [router, sessionReady]);

  useEffect(() => {
    if (isError) router.replace('/login');
  }, [isError, router]);

  useEffect(() => {
    if (!user || typeof window === 'undefined') return;
    if (!isCrmRole(user.role)) {
      goToPublicApp('/');
      return;
    }
    bounceIfWrongHost(user.role, `${window.location.pathname}${window.location.search}`);
  }, [user, pathname, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function isActive(href: string) {
    if (href === '/crm/bao-cao' && (pathname === '/crm/reports' || pathname.startsWith('/crm/reports/'))) return true;
    if (href === '/crm') return pathname === '/crm';
    const matches = pathname === href || pathname.startsWith(`${href}/`);
    if (!matches) return false;
    const coveredByChild = NAV.some((section) =>
      section.items.some(
        (item) =>
          item.href !== href &&
          item.href.startsWith(`${href}/`) &&
          (pathname === item.href || pathname.startsWith(`${item.href}/`)),
      ),
    );
    return !coveredByChild;
  }

  if (!sessionReady || isLoading || (hasToken && !user && !isError)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--admin-bg)] text-sm text-slate-500">
        Đang tải CRM...
      </div>
    );
  }

  const sidebar = (
    <aside className="flex h-full w-[248px] flex-col border-r border-slate-200/90 bg-white">
      <div className="shrink-0 border-b border-slate-100 px-4 py-4">
        <BrandSidebarLockup href="/crm" />
        <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
          <BadgePercent className="h-3 w-3" />
          CRM
          <span className="brand-accent-dot ml-0.5" aria-hidden />
        </p>
      </div>
      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-2.5 py-4">
        {NAV.map((section) => ({
          ...section,
          items: section.items.filter(
            (item) =>
              item.href !== '/crm/settings/staff' ||
              user?.role === UserRole.SuperAdmin ||
              user?.role === UserRole.SalesManager,
          ),
        }))
          .filter((section) => section.items.length > 0)
          .map((section) => (
          <div key={section.title}>
            <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      data-active={active ? 'true' : 'false'}
                      className={clsx(
                        'crm-nav-link flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium',
                        active
                          ? 'bg-brand-600 text-white'
                          : 'text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-[0_8px_18px_rgba(76,62,201,0.12)]',
                      )}
                    >
                      <Icon className={clsx('h-4 w-4 shrink-0', active ? 'opacity-95' : 'opacity-80')} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="shrink-0 border-t border-slate-100 p-3">
        <p className="truncate px-2 text-[13px] font-semibold text-slate-800">
          {user?.displayName || 'SuperAdmin'}
        </p>
        <p className="truncate px-2 text-[11px] text-slate-400">{user?.email}</p>
        <button
          type="button"
          onClick={() => void logout().then(() => goToPublicApp('/login'))}
          className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[13px] font-medium text-rose-600 hover:bg-rose-50"
        >
          <LogOut className="h-4 w-4" /> Đăng xuất
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-[var(--admin-bg)]">
      <div className="sticky top-0 z-40 hidden h-screen shrink-0 print:hidden lg:block">{sidebar}</div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex print:hidden lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Đóng menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 h-full">{sidebar}</div>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col bg-[#f4f2fb]">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/70 bg-[#f4f2fb]/90 px-4 py-3 backdrop-blur print:hidden sm:px-6">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Mở menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="hidden min-w-0 sm:block">
            <p className="truncate text-sm font-semibold text-brand-600">inlink CRM</p>
            <p className="truncate text-xs text-slate-500">Kinh doanh · hóa đơn · cộng tác viên</p>
          </div>
          <CrmTopbar displayName={user?.displayName || 'SuperAdmin'} />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <div key={pathname} className="crm-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
