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
import { HiredNoticeSwitch } from '@/components/hired-notice-switch';
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
      <Icon
        className={clsx(
          'h-4 w-4 shrink-0',
          active ? 'text-brand-500' : 'text-slate-400',
        )}
        strokeWidth={1.75}
      />
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span className="rounded bg-brand-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
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
          <div className="mb-3 border-b border-slate-100 px-1 pb-3">
            <HiredNoticeSwitch wide />
          </div>
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
              href="/profile?tab=skills"
              label="Kỹ năng & Chứng chỉ"
              icon={BadgeCheck}
            />
            <NavItem
              href="/viec-lam?tab=saved"
              label="Việc làm đã lưu"
              icon={Bookmark}
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
              active={isActivePath(pathname, '/applications')}
            />
            <NavItem
              href="/connections"
              label="Yêu cầu kết nối"
              icon={Users}
              active={isActivePath(pathname, '/connections')}
            />
            <NavItem
              href="/progress"
              label="Tiến trình"
              icon={Target}
              active={isActivePath(pathname, '/progress')}
            />
            <NavItem
              href="/viec-lam?tab=applied"
              label="Việc đã ứng tuyển"
              icon={Send}
              active={false}
            />
            <NavItem
              href="/progress#interviews"
              label="Lịch phỏng vấn"
              icon={CalendarDays}
              active={false}
            />
            <NavItem
              href="/progress#offers"
              label="Đề nghị làm việc"
              icon={Gift}
              active={false}
            />
            <NavItem
              href="/progress#onboarding"
              label="Quá trình nhận việc"
              icon={UserPlus}
              active={false}
            />
          </nav>

          <div className="mt-3 space-y-0.5 border-t border-slate-100 pt-3">
            <NavItem
              href="/recommended"
              label="Gợi ý việc làm AI"
              icon={Sparkles}
              badge="NEW"
              active={isActivePath(pathname, '/recommended')}
            />
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
