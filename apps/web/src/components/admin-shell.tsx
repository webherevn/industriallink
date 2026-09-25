'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { LogOut, Menu, Shield, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { UserRole } from '@industriallink/contracts';
import { BrandSidebarLockup } from '@/components/brand-logo';
import { restoreSession, tokenStore } from '@/lib/api';
import { ADMIN_NAV_SECTIONS } from '@/lib/admin-nav';
import { fetchMe, logout } from '@/lib/auth';
import { bounceIfWrongHost, goToPublicApp } from '@/lib/hosts';

export function AdminShell({ children }: { children: ReactNode }) {
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
    if (!tokenStore.get()) {
      router.replace('/login');
    }
  }, [router, sessionReady]);

  useEffect(() => {
    if (isError) router.replace('/login');
  }, [isError, router]);

  useEffect(() => {
    if (!user || typeof window === 'undefined') return;
    if (user.role !== UserRole.SuperAdmin) {
      goToPublicApp('/');
      return;
    }
    bounceIfWrongHost(user.role, `${window.location.pathname}${window.location.search}`);
  }, [user]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function onLogout() {
    await logout();
    goToPublicApp('/login');
  }

  function isActive(href: string) {
    if (href === '/admin') return pathname === '/admin';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  if (!sessionReady || isLoading || (hasToken && !user && !isError)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F1F5F9] text-slate-500">
        Đang tải admin...
      </div>
    );
  }

  if (user && user.role !== UserRole.SuperAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F1F5F9] text-slate-500">
        Không có quyền Superadmin
      </div>
    );
  }

  const sidebar = (
    <aside className="flex h-full w-[260px] flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-5">
        <BrandSidebarLockup href="/admin" />
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
          <Shield className="h-3 w-3" /> Superadmin
        </p>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {ADMIN_NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                if (item.soon) {
                  return (
                    <li key={item.label}>
                      <span className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-400">
                        <Icon className="h-4 w-4" />
                        {item.label}
                        <span className="ml-auto text-[10px] uppercase">Soon</span>
                      </span>
                    </li>
                  );
                }
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={clsx(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                        active
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <p className="truncate px-2 text-xs font-semibold text-slate-700">
          {user?.displayName || 'Admin'}
        </p>
        <p className="truncate px-2 text-[11px] text-slate-400">{user?.email}</p>
        <button
          type="button"
          onClick={onLogout}
          className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-[13px] font-medium text-rose-600 hover:bg-rose-50"
        >
          <LogOut className="h-4 w-4" /> Đăng xuất
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-[#F1F5F9]">
      <div className="hidden lg:block">{sidebar}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Đóng menu"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative z-10 h-full shadow-xl">{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div>
            <p className="text-sm font-bold text-slate-900">inlink Admin</p>
            <p className="text-xs text-slate-500">CMS · SEO · vận hành nền tảng</p>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
