'use client';

import clsx from 'clsx';
import {
  BadgeCheck,
  Bell,
  Bookmark,
  CalendarDays,
  ClipboardList,
  FileText,
  Gift,
  Headphones,
  LayoutDashboard,
  Link2,
  MessageCircle,
  Send,
  Settings2,
  Sparkles,
  Target,
  UserPlus,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ProfileAvatar } from '@/components/profile-avatar';
import { logout } from '@/lib/auth';

function isActivePath(pathname: string, href: string): boolean {
  const pathOnly = href.split('#')[0].split('?')[0];
  if (pathOnly === '/viec-lam' || pathOnly === '/jobs') {
    return (
      pathname === '/viec-lam' ||
      pathname.startsWith('/viec-lam/') ||
      pathname === '/jobs' ||
      pathname.startsWith('/jobs/')
    );
  }
  if (pathOnly === '/dashboard') {
    return pathname === '/dashboard';
  }
  return pathname === pathOnly || pathname.startsWith(`${pathOnly}/`);
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className={clsx('progress-nav-item', active && 'progress-nav-item-active')}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span
          className={clsx(
            'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
            active ? 'bg-accent-400 text-white' : 'bg-brand-600 text-white',
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
      {children}
    </p>
  );
}

/**
 * Sidebar ứng viên (TopCV-style): Cá nhân · Hoạt động · AI/Thông báo · Cài đặt.
 */
export function CandidateSidebar({
  displayName,
  email,
  hasAvatar = false,
  position,
  profileCompletion,
  showProfileCard = true,
  showSupport = true,
}: {
  displayName: string;
  email?: string | null;
  hasAvatar?: boolean;
  position?: string | null;
  profileCompletion?: number | null;
  showProfileCard?: boolean;
  showSupport?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function onLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-4 space-y-3 animate-soft-rise">
        {showProfileCard && (
          <div className="progress-card p-5">
            <div className="flex flex-col items-center text-center">
              <ProfileAvatar
                displayName={displayName}
                email={email}
                hasAvatar={hasAvatar}
                size="card"
                editable={false}
                className="transition-transform duration-300 hover:scale-105"
              />
              <p className="mt-3 text-[15px] font-bold text-slate-900">{displayName}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {position ?? 'Chưa cập nhật vị trí'}
              </p>
            </div>
            {typeof profileCompletion === 'number' && (
              <div className="mt-4">
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Hoàn thiện hồ sơ</span>
                  <span className="font-bold text-brand-600">{profileCompletion}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-all duration-500"
                    style={{ width: `${profileCompletion}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="progress-card p-3">
          <SectionLabel>Cá nhân</SectionLabel>
          <nav className="space-y-0.5">
            <NavItem
              href="/dashboard"
              label="Tổng quan"
              icon={LayoutDashboard}
              active={pathname === '/dashboard'}
            />
            <NavItem
              href="/profile"
              label="Hồ sơ của tôi"
              icon={UserRound}
              active={pathname === '/profile' || pathname.startsWith('/profile/')}
            />
            <NavItem
              href="/cv/create"
              label="CV & Thư xin việc"
              icon={FileText}
              active={
                isActivePath(pathname, '/cv/create') ||
                isActivePath(pathname, '/upload') ||
                pathname.startsWith('/cv/')
              }
            />
            <NavItem
              href="/saved-jobs"
              label="Việc làm đã lưu"
              icon={Bookmark}
              active={isActivePath(pathname, '/saved-jobs')}
            />
          </nav>

          <p className="mb-1 mt-4 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Hoạt động
          </p>
          <nav className="space-y-0.5">
            <NavItem
              href="/applications"
              label="Đơn ứng tuyển"
              icon={ClipboardList}
              active={isActivePath(pathname, '/applications') || isActivePath(pathname, '/progress')}
            />
            <NavItem
              href="/connections"
              label="Yêu cầu kết nối"
              icon={Users}
              active={isActivePath(pathname, '/connections')}
            />
            <NavItem
              href="/chat"
              label="Chat"
              icon={MessageCircle}
              active={isActivePath(pathname, '/chat')}
            />
            <NavItem
              href="/dashboard/partner"
              label="Cộng tác viên"
              icon={Link2}
              active={isActivePath(pathname, '/dashboard/partner')}
            />
          </nav>

          <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
            <Link
              href="/recommended"
              className={clsx(
                'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] transition',
                isActivePath(pathname, '/recommended')
                  ? 'border-[#072348] bg-[#072348] text-white shadow-sm'
                  : 'border-[#FAD9B1] bg-gradient-to-r from-[#FFF5E8] to-[#FFEFD8] text-[#072348] hover:border-[#F3C48A] hover:from-[#FFEFD8] hover:to-[#FFE7C7]',
              )}
            >
              <Sparkles
                className={clsx(
                  'h-4 w-4 shrink-0',
                  isActivePath(pathname, '/recommended') ? 'text-amber-300' : 'text-[#E8872A]',
                )}
                strokeWidth={2}
              />
              <span className="flex-1 truncate font-medium">
                <strong className="font-bold">Gợi ý</strong> việc làm AI
              </span>
              <span className="rounded-md bg-[#E8872A] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                NEW
              </span>
            </Link>
            <NavItem
              href="/notifications"
              label="Thông báo"
              icon={Bell}
              active={isActivePath(pathname, '/notifications')}
            />
          </div>

          <p className="mb-1 mt-4 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Cài đặt
          </p>
          <nav className="space-y-0.5">
            <NavItem
              href="/account"
              label="Tài khoản & Bảo mật"
              icon={Settings2}
              active={isActivePath(pathname, '/account')}
            />
          </nav>

          <button
            type="button"
            onClick={() => void onLogout()}
            className="progress-nav-item mt-1 w-full text-left text-slate-500"
          >
            Đăng xuất
          </button>
        </div>

        {showSupport && (
          <div className="progress-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 ring-1 ring-brand-100">
                <Headphones className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Bạn cần hỗ trợ?</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  Liên hệ đội ngũ inlink khi cần hỗ trợ hồ sơ hoặc ứng tuyển.
                </p>
              </div>
            </div>
            <a
              href="mailto:support@inlink.vn"
              className="progress-btn mt-3 w-full border border-brand-200 bg-white text-brand-600 hover:bg-brand-50"
            >
              Liên hệ hỗ trợ
            </a>
          </div>
        )}
      </div>
    </aside>
  );
}
