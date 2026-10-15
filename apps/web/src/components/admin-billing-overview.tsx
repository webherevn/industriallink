'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Coins,
  CreditCard,
  ExternalLink,
  FileText,
  Package,
  Settings as SettingsIcon,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import { AdminShell } from '@/components/admin-shell';
import { Card } from '@/components/ui';
import { fetchPublicBillingConfig } from '@/lib/admin-billing';
import { formatPriceVnd } from '@/lib/format-billing';

const HUB = [
  {
    href: '/admin/billing/platform-plans',
    icon: Package,
    title: 'Gói nền tảng',
    desc: '5 gói Tầng 1: Khám phá, Tin đăng, Tin đăng Plus, Doanh nghiệp, Enterprise.',
  },
  {
    href: '/admin/billing/sourcing-plans',
    icon: Shield,
    title: 'Gói Săn nhân sự',
    desc: '3 gói Tầng 2: Cơ bản, Tiêu chuẩn, Chuyên sâu. Phí dịch vụ riêng, Credit riêng.',
  },
  {
    href: '/admin/billing/credit-topups',
    icon: Coins,
    title: 'Top-up Credit',
    desc: '3 mức 20/50/100 lượt. Đơn giá tự tính từ price/creditCount.',
  },
  {
    href: '/admin/billing/content',
    icon: FileText,
    title: 'Nội dung trang bảng giá',
    desc: 'SEO, tiêu đề section, FAQ, hotline, Zalo, email — không gồm số liệu gói.',
  },
  {
    href: '/admin/billing/settings',
    icon: SettingsIcon,
    title: 'Policy & tiền tệ',
    desc: 'Quy tắc trừ Credit (mở hồ sơ, mở lại, UV chủ động…) + cấu hình VND/$ hiển thị.',
  },
  {
    href: '/admin/billing/audit',
    icon: Banknote,
    title: 'Lịch sử thay đổi',
    desc: 'Audit log: mọi thay đổi giá/quota/policy đều được ghi với actor + diff.',
  },
];

export function AdminBillingOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ['billing-public-config'],
    queryFn: fetchPublicBillingConfig,
  });

  const stats: { label: string; value: string; sub?: string; icon: React.ElementType }[] = [];
  if (data) {
    const activePlatform = data.platformPlans.filter((p) => p.isActive).length;
    const activeSourcing = data.sourcingPlans.filter((p) => p.isActive).length;
    const activeTopup = data.creditTopups.filter((p) => p.isActive).length;
    const cheapest = data.platformPlans
      .filter((p) => p.isActive && p.code !== 'ENTERPRISE' && p.code !== 'KHAM_PHA')
      .sort((a, b) => Number(BigInt(a.priceVnd) - BigInt(b.priceVnd)))[0];
    const topTopup = data.creditTopups
      .filter((p) => p.isActive)
      .sort((a, b) => Number(BigInt(a.priceVnd) - BigInt(b.priceVnd)))[0];

    stats.push(
      {
        label: 'Gói nền tảng active',
        value: String(activePlatform),
        sub: `trên ${data.platformPlans.length} tổng`,
        icon: Package,
      },
      {
        label: 'Gói Săn active',
        value: String(activeSourcing),
        sub: `trên ${data.sourcingPlans.length} tổng`,
        icon: Shield,
      },
      {
        label: 'Gói Top-up active',
        value: String(activeTopup),
        sub: `trên ${data.creditTopups.length} tổng`,
        icon: Coins,
      }
    );
    if (cheapest) {
      stats.push({
        label: 'Gói rẻ nhất',
        value: formatPriceVnd(cheapest.priceVnd, data.currency),
        sub: cheapest.name,
        icon: CreditCard,
      });
    }
    if (topTopup) {
      stats.push({
        label: 'Top-up rẻ nhất',
        value: formatPriceVnd(topTopup.priceVnd, data.currency),
        sub: `${topTopup.creditCount} lượt`,
        icon: CheckCircle2,
      });
    }
  }

  return (
    <AdminShell>
      <div className="admin-dash space-y-6">
        <div className="admin-dash-rise flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">
              Pricing & Plans
            </p>
            <h1 className="cms-page-title mt-1.5">Quản lý bảng giá &amp; Credit</h1>
            <div className="brand-accent-bar mt-2" />
            <p className="cms-page-subtitle mt-2">
              Cấu hình giá, quota, top-up, policy từ đây. Thay đổi áp dụng ngay, không cần restart.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="admin-dash-card flex items-center gap-3 p-4">
                  <div className="admin-dash-skel h-12 w-full" />
                </div>
              ))
            : stats.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} className="admin-dash-card flex items-center gap-3 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-accent-soft)] text-accent-600">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        {s.label}
                      </p>
                      <p className="text-xl font-bold tabular-nums leading-none text-[var(--brand-navy)]">
                        {s.value}
                      </p>
                      {s.sub ? <p className="mt-0.5 text-[11px] text-slate-500">{s.sub}</p> : null}
                    </div>
                  </div>
                );
              })}
        </div>

        {/* Hubs */}
        <div className="grid gap-4 md:grid-cols-2">
          {HUB.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="admin-dash-card flex items-start gap-4 p-5 hover:border-accent-200"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#072348] to-[#0d3b80] text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[var(--brand-navy)]">{item.title}</h3>
                    <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{item.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Tip */}
        <Card className="border-amber-200 bg-amber-50/50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Banknote className="h-4 w-4" />
            </div>
            <div className="text-sm text-amber-900">
              <p className="font-semibold">Về tiền tệ &amp; giá</p>
              <p className="mt-1 text-amber-800/80">
                Toàn bộ giá lưu DB dạng <strong>VND integer</strong>. Ký hiệu hiển thị (mặc định
                <code className="mx-1 rounded bg-white/60 px-1 py-0.5 font-mono">$</code>) và vị trí
                đặt (trước/sau) đều điều chỉnh được ở <Link href="/admin/billing/settings" className="font-semibold underline">Settings</Link>.
                Có thể bật tham chiếu USD chỉ để so sánh, không ảnh hưởng thanh toán thực.
              </p>
            </div>
          </div>
        </Card>

        {/* External link to public page */}
        {data ? (
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Trang bảng giá public</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Khách hàng/ứng viên xem bảng giá lấy từ <code className="font-mono">/api/v1/billing/public-config</code>.
                </p>
              </div>
              <Link
                href="/bang-gia"
                target="_blank"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#072348] px-3 text-sm font-semibold text-white hover:bg-[#0d3b80]"
              >
                Xem <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Card>
        ) : null}
      </div>
    </AdminShell>
  );
}
