'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowRight,
  Banknote,
  BarChart3,
  Check,
  ChevronDown,
  Coins,
  Contact2,
  CreditCard,
  ExternalLink,
  FileText,
  Mail,
  Menu,
  MessageCircle,
  Package,
  Phone,
  Play,
  Shield,
  Sparkles,
  Star,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import type {
  BillingPublicConfig,
  BillingPlatformPlanView,
  BillingSourcingPlanView,
  BillingCreditTopupView,
  BillingCurrencyDisplay,
  BillingPageContentView,
  SourcingServiceScope,
} from '@industriallink/contracts';
import {
  BILLING_PLAN_ACTION_LABELS,
  BILLING_PLAN_BILLABLE_ACTIONS,
  DEFAULT_BILLING_PAGE_CONTENT,
  UserRole,
} from '@industriallink/contracts';
import { fetchPublicBillingConfig } from '@/lib/admin-billing';
import { tokenStore } from '@/lib/api';
import { fetchMe } from '@/lib/auth';
import { formatPriceVnd, formatReferenceUsd } from '@/lib/format-billing';
import { EnterpriseConsultButton } from './enterprise-consult-button';
import { BrandMark } from './brand-logo';
import { CompareSection } from './pricing-compare';

const NTD_ROLES = new Set<string>([
  UserRole.Recruiter,
  UserRole.HiringManager,
  UserRole.CompanyAdmin,
  UserRole.SuperAdmin,
]);

const SCOPE_LABEL: Record<SourcingServiceScope, string> = {
  ai_match: 'AI tìm / Matching',
  filter_rank: 'Lọc & xếp hạng',
  shortlist: 'Shortlist',
  strengths_gaps: 'Điểm mạnh / Khoảng thiếu',
  priority: 'Ứng viên ưu tiên',
  outreach: 'Chủ động tiếp cận',
  follow_up: 'Theo dõi phản hồi',
  replacement: 'Ứng viên thay thế',
};

const ALL_SCOPES: SourcingServiceScope[] = [
  'ai_match',
  'filter_rank',
  'shortlist',
  'strengths_gaps',
  'priority',
  'outreach',
  'follow_up',
  'replacement',
];

const UNIT_LABEL: Record<'per_jd' | 'per_month', string> = {
  per_jd: '/ JD',
  per_month: '/ tháng',
};

/** Cùng cỡ cho Miễn phí / số tiền / Báo giá — nhỏ vừa ở lưới 5 cột, lớn hơn khi card rộng. */
const PRICE_TEXT =
  'font-bold leading-none tracking-tight text-[#072348] text-lg sm:text-xl lg:text-lg xl:text-xl';

function PlanPrice({
  value,
  currency,
}: {
  value: string;
  currency: BillingCurrencyDisplay;
}) {
  const formatted = formatPriceVnd(value, currency);
  const symbol = currency.displaySymbol;
  const symbolBefore = currency.symbolBefore && formatted.startsWith(symbol);
  const symbolAfter = !currency.symbolBefore && formatted.endsWith(symbol);
  const amount = symbolBefore
    ? formatted.slice(symbol.length)
    : symbolAfter
      ? formatted.slice(0, -symbol.length)
      : formatted;

  return (
    <p className={clsx('flex min-w-0 max-w-full flex-nowrap items-baseline gap-0.5', PRICE_TEXT)}>
      {symbolBefore ? <span className="shrink-0 text-[0.72em]">{symbol}</span> : null}
      <span className="min-w-0 tabular-nums">{amount}</span>
      {symbolAfter ? <span className="shrink-0 text-[0.72em]">{symbol}</span> : null}
    </p>
  );
}

function PlanPriceLabel({ children }: { children: string }) {
  return <p className={PRICE_TEXT}>{children}</p>;
}

function PlanPriceMeta({ children }: { children?: ReactNode }) {
  return <p className="mt-1 min-h-[16px] text-[11px] leading-4 text-slate-500">{children ?? '\u00a0'}</p>;
}

function SalePrice({
  list,
  sale,
  percent,
  label,
  currency,
}: {
  list: string;
  sale?: string | null;
  percent?: number | null;
  label?: string | null;
  currency: BillingCurrencyDisplay;
}) {
  const onSale = Boolean(percent && percent > 0 && sale && sale !== list);
  return (
    <div>
      {onSale ? (
        <p className="text-xs tabular-nums text-slate-400 line-through">{formatPriceVnd(list, currency)}</p>
      ) : null}
      <PlanPrice value={onSale ? sale! : list} currency={currency} />
      {onSale ? (
        <p className="mt-1 inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
          {label ?? `Giảm ${percent}%`}
        </p>
      ) : null}
    </div>
  );
}

const FEATURE_ICONS = [Sparkles, FileText, UserCheck, Users, BarChart3, Coins];
const TRUST_ICONS = [Shield, Banknote, Sparkles];

// ============================================================================
// TOP NAV (PUBLIC)
// ============================================================================
function TopNav({ checkoutReady }: { checkoutReady: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const startHref = checkoutReady ? '/recruiter/billing' : '/register';
  const startLabel = checkoutReady ? 'Gói của tôi' : 'Đăng ký miễn phí';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <BrandMark size={32} />

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 lg:flex" aria-label="Điều hướng trang">
          {[
            ['#pricing', 'Gói giá'],
            ['#features', 'Tính năng'],
            ['#compare', 'So sánh'],
            ['#how', 'Cách tính phí'],
            ['#faq', 'FAQ'],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-[#072348]"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Desktop CTA */}
        <div className="hidden items-center gap-2 lg:flex">
          {checkoutReady ? null : (
          <Link
            href="/login"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Đăng nhập
          </Link>
          )}
          <Link
            href={startHref}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-[#072348] transition-colors hover:bg-amber-400"
          >
            {startLabel}
          </Link>
        </div>

        {/* Mobile CTA + hamburger */}
        <div className="flex items-center gap-2 lg:hidden">
          <Link
            href={startHref}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-[#072348] transition-colors hover:bg-amber-400"
          >
            {checkoutReady ? 'Gói của tôi' : 'Đăng ký'}
          </Link>
          <button
            type="button"
            aria-label="Mở menu"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-1">
            {[
              ['#pricing', 'Gói giá'],
              ['#features', 'Tính năng'],
              ['#compare', 'So sánh'],
              ['#how', 'Cách tính phí'],
              ['#faq', 'FAQ'],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-[#072348]"
              >
                {label}
              </a>
            ))}
            <hr className="my-2 border-slate-200" />
            {checkoutReady ? null : (
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Đăng nhập
            </Link>
            )}
            <Link
              href={startHref}
              onClick={() => setMenuOpen(false)}
              className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-[#072348] transition-colors hover:bg-amber-400"
            >
              {startLabel}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

// ============================================================================
// HERO (PUBLIC)
// ============================================================================
function HeroPublic({
  stats,
  page,
  checkoutReady,
}: {
  stats: ReturnType<typeof computeStats> | null;
  page: BillingPageContentView;
  checkoutReady: boolean;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#072348] via-[#0a2d5e] to-[#0d3b80] py-14 text-white sm:py-20">
      {/* Decorative blobs */}
      <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-amber-500/15 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl" aria-hidden="true" />
      <div className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-amber-400/5 blur-3xl" aria-hidden="true" />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          {/* Badge */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200">
            <Sparkles className="h-3 w-3" /> {page.heroBadge}
          </span>

          {/* Headline */}
          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            <span className="block">{page.heroHeading}</span>
            <span className="bg-gradient-to-r from-amber-300 to-amber-200 bg-clip-text text-transparent">
              {page.heroHeadingAccent}
            </span>
          </h1>

          {/* Sub */}
          <p className="mt-5 text-base text-slate-300 sm:text-lg">{page.heroSubtitle}</p>

          {/* CTA */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={checkoutReady ? '/recruiter/billing' : '/register'}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-500 px-6 text-sm font-bold text-[#072348] shadow-lg shadow-amber-500/30 transition-colors hover:bg-amber-400"
            >
              {checkoutReady ? 'Gói của tôi' : page.heroCtaPrimary} <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/15"
            >
              <Play className="h-4 w-4" /> {page.heroCtaSecondary}
            </a>
          </div>

          {/* Social proof */}
          <p className="mt-6 text-sm text-slate-400">{page.heroSocialProof}</p>

          {/* Stats */}
          {stats && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-slate-300">
              <span>
                <strong className="text-white">{stats.planCount}</strong> gói nền tảng
              </span>
              <span className="text-slate-500">·</span>
              <span>
                <strong className="text-white">{stats.sourcingCount}</strong> gói Săn
              </span>
              <span className="text-slate-500">·</span>
              <span>
                <strong className="text-white">{stats.topupCount}</strong> mức Top-up
              </span>
              {stats.savingPct && (
                <>
                  <span className="text-slate-500">·</span>
                  <span>
                    Tiết kiệm đến <strong className="text-amber-300">{stats.savingPct}%</strong> khi
                    mua 100 Credit
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// HERO (RECRUITER)
// ============================================================================
function HeroRecruiter({ page }: { page: BillingPageContentView }) {
  return (
    <section className="border-b border-slate-200 bg-white py-6 sm:py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-600">
          {page.recruiterKicker}
        </p>
        <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl">
          {page.recruiterHeading}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{page.recruiterSubtitle}</p>
      </div>
    </section>
  );
}

// ============================================================================
// SECTION NAV (STICKY TABS)
// ============================================================================
type PricingTab = 'platform' | 'sourcing' | 'credit';

function SectionNav({
  isRecruiter,
  tab,
  onTabChange,
  page,
  embedded = false,
}: {
  isRecruiter: boolean;
  tab: PricingTab;
  onTabChange: (tab: PricingTab) => void;
  page: BillingPageContentView;
  embedded?: boolean;
}) {
  if (isRecruiter && !embedded) return null;
  return (
    <nav
      className={clsx(
        'z-20 border-b border-slate-200 bg-white/90 backdrop-blur-md',
        embedded ? 'rounded-2xl' : 'sticky top-[57px]',
      )}
      aria-label="Chuyển tab bảng giá"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex rounded-xl bg-slate-100 p-1">
          {(
            [
              ['platform', page.platformTitle, Package],
              ['sourcing', page.sourcingTitle, Shield],
              ['credit', page.creditTitle, Coins],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={tab === id}
              onClick={() => onTabChange(id)}
              className={clsx(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                tab === id
                  ? 'bg-white text-[#072348] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        {!embedded ? (
          <a
            href="#contact"
            className="hidden items-center gap-1 text-[12px] font-semibold text-slate-500 transition-colors hover:text-slate-900 sm:flex"
          >
            {page.consultNavText}
          </a>
        ) : null}
      </div>
    </nav>
  );
}

// ============================================================================
// FEATURES SECTION
// ============================================================================
function FeaturesSection({ page }: { page: BillingPageContentView }) {
  return (
    <section id="features" className="bg-white py-14 sm:py-20 scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold text-[#072348] sm:text-3xl">{page.featuresTitle}</h2>
          <p className="mt-2 text-sm text-slate-500">{page.featuresSubtitle}</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {page.features.map((f, i) => {
            const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length] ?? Sparkles;
            return (
              <div
                key={`${f.title}-${i}`}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-[#072348]">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// HOW IT WORKS
// ============================================================================
function HowItWorksSection({ page }: { page: BillingPageContentView }) {
  return (
    <section
      id="how"
      className="relative overflow-hidden bg-gradient-to-br from-[#072348] to-[#0d3b80] py-14 text-white sm:py-20 scroll-mt-20"
    >
      <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">{page.howTitle}</h2>
          <p className="mt-2 text-sm text-slate-300">{page.howSubtitle}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {page.howSteps.map((step, i) => (
            <div key={`${step.title}-${i}`} className="relative">
              {i < page.howSteps.length - 1 && (
                <div className="absolute -right-3 top-6 hidden text-slate-600 lg:block" aria-hidden="true">
                  <ArrowRight className="h-5 w-5" />
                </div>
              )}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                <span className="text-4xl font-bold text-amber-400">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-3 text-base font-bold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-slate-300">{page.howFooter}</p>
      </div>
    </section>
  );
}

function formatActionCost(
  plan: BillingPlatformPlanView,
  action: (typeof BILLING_PLAN_BILLABLE_ACTIONS)[number],
): string {
  const row = plan.actionCosts?.find((c) => c.action === action && c.isActive);
  if (!row) return '—';
  return row.cost === 0 ? 'Miễn phí' : `${row.cost} Credit`;
}

// ============================================================================
// CONTACT CTA
// ============================================================================
function ContactCTASection({ page }: { page: BillingPageContentView }) {
  const channels = [
    {
      icon: Mail,
      label: 'Email',
      value: page.contactEmail,
      href: `mailto:${page.contactEmail}`,
      desc: page.contactEmailDesc,
    },
    {
      icon: Phone,
      label: 'Hotline',
      value: page.contactHotline,
      href: page.contactHotlineHref,
      desc: page.contactHotlineDesc,
    },
    {
      icon: MessageCircle,
      label: 'Zalo OA',
      value: page.contactZaloLabel,
      href: page.contactZaloHref,
      desc: page.contactZaloDesc,
    },
  ];

  return (
    <section id="contact" className="bg-white py-14 sm:py-20 scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#072348] to-[#0d3b80] p-8 text-white sm:p-12">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">{page.contactTitle}</h2>
            <p className="mt-3 text-sm text-slate-300">{page.contactSubtitle}</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {channels.map((ch) => (
                <a
                  key={ch.label}
                  href={ch.href}
                  className="group flex flex-col items-center rounded-2xl border border-white/20 bg-white/5 p-5 backdrop-blur-sm transition-colors hover:bg-white/10"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
                    <ch.icon className="h-5 w-5" />
                  </div>
                  <p className="text-xs text-slate-400">{ch.label}</p>
                  <p className="mt-1 text-sm font-bold text-white">{ch.value}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">{ch.desc}</p>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// FOOTER MINI
// ============================================================================
function FooterMini({ page }: { page: BillingPageContentView }) {
  const cols = [
    {
      title: 'Sản phẩm',
      links: [
        ['#pricing', 'Bảng giá'],
        ['#features', 'Tính năng'],
        ['/register', 'Đăng ký miễn phí'],
        ['/login', 'Đăng nhập'],
      ],
    },
    {
      title: 'Công ty',
      links: [
        ['/about', 'Giới thiệu'],
        ['/blog', 'Blog'],
        ['/careers', 'Tuyển dụng'],
        ['#contact', 'Liên hệ'],
      ],
    },
    {
      title: 'Pháp lý',
      links: [
        ['/terms', 'Điều khoản'],
        ['/privacy', 'Chính sách bảo mật'],
        ['/cookies', 'Cookie Policy'],
      ],
    },
  ];

  return (
    <footer className="border-t border-slate-200 bg-white py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <BrandMark size={28} />
            <p className="text-xs text-slate-500">{page.footerTagline}</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {cols.map((col) => (
              <div key={col.title}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {col.title}
                </p>
                <ul className="space-y-1.5">
                  {col.links.map(([href, label]) => (
                    <li key={href}>
                      <a
                        href={href}
                        className="text-sm text-slate-600 transition-colors hover:text-[#072348]"
                      >
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-8 border-t border-slate-100 pt-6 text-center">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} inlink. Tất cả quyền được bảo lưu.
          </p>
        </div>
      </div>
    </footer>
  );
}

// ============================================================================
// MOBILE BOTTOM BAR
// ============================================================================
function MobileBottomBar({ page }: { page: BillingPageContentView }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md lg:hidden"
      aria-label="Liên hệ nhanh"
    >
      <div className="flex items-center gap-2">
        <a
          href={page.contactHotlineHref}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#072348] py-3 text-xs font-bold text-white transition-colors hover:bg-[#0d3b80]"
        >
          <Phone className="h-3.5 w-3.5" />
          Gọi ngay
        </a>
        <a
          href={page.contactZaloHref}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-500 py-3 text-xs font-bold text-white transition-colors hover:bg-blue-400"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Zalo
        </a>
        <a
          href="#contact"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-3 text-xs font-bold text-[#072348] transition-colors hover:bg-amber-400"
        >
          <Contact2 className="h-3.5 w-3.5" />
          Tư vấn
        </a>
      </div>
    </div>
  );
}

// ============================================================================
// ZALO FAB
// ============================================================================
function ZaloFAB({ page }: { page: BillingPageContentView }) {
  return (
    <a
      href={page.contactZaloHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Liên hệ Zalo"
      className="fixed bottom-20 right-5 z-40 hidden lg:flex"
    >
      <div className="group relative">
        <div className="absolute -inset-2 animate-ping rounded-full bg-blue-400/30 opacity-75" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 shadow-lg transition-transform hover:scale-110">
          <MessageCircle className="h-6 w-6 text-white" />
        </div>
        <span className="absolute -top-8 right-0 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
          Zalo OA
        </span>
      </div>
    </a>
  );
}

// ============================================================================
// PLATFORM PLANS
// ============================================================================
function PlatformPlansView({
  plans,
  currency,
  enterprise,
  onSourcing,
  onTopup,
  isRecruiter,
  checkoutReady,
  planCtaHref,
  freeCtaHref,
  enterpriseCtaHref,
  canRequestEnterprise,
  page,
}: {
  plans: BillingPlatformPlanView[];
  currency: BillingCurrencyDisplay;
  enterprise: BillingPlatformPlanView | undefined;
  onSourcing: () => void;
  onTopup: () => void;
  isRecruiter: boolean;
  checkoutReady: boolean;
  planCtaHref: (code: string) => string;
  freeCtaHref: () => string;
  enterpriseCtaHref: () => string;
  canRequestEnterprise: boolean;
  page: BillingPageContentView;
}) {
  const visible = plans.filter((p) => p.isActive);

  return (
    <div>
      {/* Section header */}
      <div className="mb-8 text-center">
        <h2 id="pricing" className="text-2xl font-bold text-[#072348] sm:text-3xl scroll-mt-20">
          {page.platformTitle}
        </h2>
        <p className="mt-2 text-sm text-slate-500">{page.platformSubtitle}</p>
        {visible.some((p) => p.promoPercent) ? (
          <p className="mx-auto mt-3 max-w-3xl rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-800">
            Khuyến mại HOT ngày ra mắt: Tin đăng, Tin đăng Plus và Doanh nghiệp giảm 50%. Áp dụng đến 23/10/2027.
          </p>
        ) : null}
      </div>

      {/* Cards grid */}
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {visible.map((p) => (
          <PlatformPlanCard
            key={p.id}
            plan={p}
            currency={currency}
            isRecruiter={isRecruiter}
            checkoutReady={checkoutReady}
            planCtaHref={planCtaHref}
            freeCtaHref={freeCtaHref}
            enterpriseCtaHref={enterpriseCtaHref}
            canRequestEnterprise={canRequestEnterprise}
          />
        ))}
      </div>

      {/* Enterprise banner */}
      {enterprise ? (
        <div className="mt-6 rounded-2xl bg-gradient-to-r from-[#072348] to-[#0d3b80] p-5 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">
                {enterprise.name}
              </p>
              <p className="mt-1 text-base font-semibold">Cho tập đoàn & đội ngũ lớn</p>
              <p className="mt-0.5 text-sm text-slate-300">{enterprise.description}</p>
            </div>
            {canRequestEnterprise ? (
              <EnterpriseConsultButton
                className="inline-flex h-10 items-center justify-center rounded-xl bg-amber-500 px-4 text-sm font-bold text-[#072348] transition-colors hover:bg-amber-400 disabled:opacity-60"
                label={isRecruiter ? 'Yêu cầu tư vấn' : 'Liên hệ tư vấn'}
                noteClassName="mt-2 max-w-xs text-xs text-amber-100"
                errorClassName="mt-2 max-w-xs text-xs text-rose-200"
              />
            ) : (
              <a
                href={enterpriseCtaHref()}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-amber-500 px-4 text-sm font-bold text-[#072348] transition-colors hover:bg-amber-400"
              >
                {isRecruiter ? 'Yêu cầu tư vấn' : 'Liên hệ tư vấn'}{' '}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      ) : null}

      {/* Cross-sell */}
      {!isRecruiter ? (
        <CrossSellCard
          title="Cần iLink tìm giúp?"
          desc="Dịch vụ Săn nhân sự — chúng tôi tìm và sàng lọc giúp bạn."
          cta="Xem gói Săn"
          onClick={onSourcing}
        />
      ) : null}
    </div>
  );
}

function PlatformPlanCard({
  plan,
  currency,
  isRecruiter,
  checkoutReady,
  planCtaHref,
  freeCtaHref,
  enterpriseCtaHref,
  canRequestEnterprise,
}: {
  plan: BillingPlatformPlanView;
  currency: BillingCurrencyDisplay;
  isRecruiter: boolean;
  checkoutReady: boolean;
  planCtaHref: (code: string) => string;
  freeCtaHref: () => string;
  enterpriseCtaHref: () => string;
  canRequestEnterprise: boolean;
}) {
  const isFree = plan.code === 'KHAM_PHA';
  const isEnterprise = plan.code === 'ENTERPRISE';
  const featured = plan.isFeatured;

  return (
    <div
      className={clsx(
        'relative flex min-w-0 flex-col rounded-2xl bg-white p-4 ring-1 transition sm:p-5',
        featured
          ? 'ring-2 ring-amber-400 shadow-xl shadow-amber-500/10'
          : 'ring-slate-200 hover:shadow-md hover:ring-slate-300'
      )}
    >
      {featured ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#072348] shadow-md">
          <Star className="h-2.5 w-2.5 fill-current" /> Gói phổ biến
        </span>
      ) : null}

      <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
      {plan.description ? (
        <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{plan.description}</p>
      ) : null}

      <div className="mt-4 min-w-0">
        {isEnterprise ? (
          <PlanPriceLabel>Báo giá</PlanPriceLabel>
        ) : isFree ? (
          <PlanPriceLabel>Miễn phí</PlanPriceLabel>
        ) : (
          <SalePrice
            list={plan.priceVnd}
            sale={plan.promoPriceVnd}
            percent={plan.promoPercent}
            label={plan.promoLabel}
            currency={currency}
          />
        )}
        <PlanPriceMeta>
          {isEnterprise
            ? 'Theo hợp đồng'
            : isFree
              ? plan.durationDays
                ? `${plan.durationDays} ngày · 1 tin thử nghiệm`
                : '14 ngày · 1 tin thử nghiệm'
              : `${UNIT_LABEL[plan.billingUnit]}${plan.durationDays ? ` · ${plan.durationDays} ngày` : ''}`}
        </PlanPriceMeta>
        <p className="min-h-[16px] text-[10px] leading-4 text-slate-400">
          {!isEnterprise && !isFree && currency.showReferenceUsd
            ? formatReferenceUsd(plan.promoPriceVnd && plan.promoPercent ? plan.promoPriceVnd : plan.priceVnd, currency)
            : '\u00a0'}
        </p>
      </div>

      <ul className="mt-4 flex-1 space-y-1.5">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[12px] text-slate-600">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
            <span>{f}</span>
          </li>
        ))}
        {plan.durationDays != null ? (
          <li className="flex items-start gap-1.5 text-[12px] text-slate-600">
            <span className="mt-0.5 h-3.5 w-3.5 shrink-0 text-center text-[10px] font-bold text-slate-400">
              ⏱
            </span>
            <span>
              {isFree
                ? `Tin hiển thị ${plan.durationDays} ngày · tạo tin mới sau ${plan.durationDays} ngày`
                : plan.billingUnit === 'per_month'
                  ? `Chu kỳ ${plan.durationDays} ngày`
                  : `Tin hiển thị ${plan.durationDays} ngày`}
            </span>
          </li>
        ) : null}
        {plan.creditQuota != null && plan.creditQuota > 0 ? (
          <li className="flex items-start gap-1.5 text-[12px] font-semibold text-amber-700">
            <Coins className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {plan.billingUnit === 'per_month'
                ? `${plan.creditQuota} lượt mở hồ sơ / tháng`
                : `${plan.creditQuota} lượt mở hồ sơ tiềm năng`}
            </span>
          </li>
        ) : null}
        {plan.jobPostQuota != null ? (
          <li className="flex items-start gap-1.5 text-[12px] text-slate-600">
            <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>
              {plan.billingUnit === 'per_month'
                ? `Tối đa ${plan.jobPostQuota} tin đang hoạt động`
                : `${plan.jobPostQuota} tin / gói`}
            </span>
          </li>
        ) : null}
        {plan.creditQuota != null && plan.creditQuota > 0
          ? BILLING_PLAN_BILLABLE_ACTIONS.filter((action) => {
          const row = plan.actionCosts?.find((c) => c.action === action && c.isActive);
          return row != null && row.cost > 0;
        }).map((action) => {
          const label = BILLING_PLAN_ACTION_LABELS[action];
          const text = formatActionCost(plan, action);
          return (
            <li key={action} className="flex items-start gap-1.5 text-[12px] text-slate-600">
              <Coins className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span>
                {label}: {text}
              </span>
            </li>
          );
        })
          : null}
      </ul>

      {isEnterprise && canRequestEnterprise ? (
        <EnterpriseConsultButton
          className={clsx(
            'mt-5 inline-flex h-10 w-full items-center justify-center rounded-xl text-sm font-bold transition disabled:opacity-60',
            featured ? 'bg-amber-500 text-[#072348] hover:bg-amber-400' : 'bg-[#072348] text-white hover:bg-[#0d3b80]',
          )}
          label="Liên hệ tư vấn"
          noteClassName="mt-2 text-xs text-slate-500"
          errorClassName="mt-2 text-xs text-rose-600"
        />
      ) : (
        <Link
          href={isEnterprise ? enterpriseCtaHref() : isFree ? freeCtaHref() : planCtaHref(plan.code)}
          className={clsx(
            'mt-5 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-bold transition',
            featured
              ? 'bg-amber-500 text-[#072348] hover:bg-amber-400'
              : isFree
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-[#072348] text-white hover:bg-[#0d3b80]',
          )}
        >
          {isEnterprise
            ? 'Liên hệ tư vấn'
            : isFree
              ? checkoutReady || isRecruiter
                ? 'Vào gói của tôi'
                : 'Đăng ký miễn phí'
              : checkoutReady || isRecruiter
                ? 'Thanh toán'
                : 'Chọn gói'}{' '}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

// ============================================================================
// SOURCING PLANS
// ============================================================================
function SourcingPlansView({
  plans,
  currency,
  onTopup,
  isRecruiter,
  planCtaHref,
  page,
}: {
  plans: BillingSourcingPlanView[];
  currency: BillingCurrencyDisplay;
  onTopup: () => void;
  isRecruiter: boolean;
  planCtaHref: (code: string) => string;
  page: BillingPageContentView;
}) {
  return (
    <div>
      <div className="mb-8 text-center">
        <h2 id="sourcing" className="text-2xl font-bold text-[#072348] sm:text-3xl scroll-mt-20">
          {page.sourcingTitle}
        </h2>
        <p className="mt-2 text-sm text-slate-500">{page.sourcingSubtitle}</p>
        <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
          Muốn iLink hỗ trợ tìm kiếm theo yêu cầu? Chọn mức độ hỗ trợ phù hợp. Giá gói đã bao gồm quyền sử dụng nền tảng cần thiết cho vị trí; không thu lại toàn bộ phí Tin đăng cho cùng vị trí.
        </p>
        {plans.some((p) => p.promoPercent) ? (
          <p className="mx-auto mt-3 max-w-3xl rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-800">
            Khuyến mại ra mắt: ba gói Tin săn giảm 30%. Mua thêm lượt không giảm giá. Áp dụng đến 23/10/2027.
          </p>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-3 md:grid-cols-2">
        {plans
          .filter((p) => p.isActive)
          .map((p) => (
            <SourcingPlanCard key={p.id} plan={p} currency={currency} planCtaHref={planCtaHref} />
          ))}
      </div>

      {!isRecruiter ? (
        <CrossSellCard
          title="Bạn sẽ tự mở hồ sơ tiềm năng?"
          desc="Mua Credit để mở hồ sơ ứng viên. Đơn giá giảm theo số lượng."
          cta="Xem Top-up Credit"
          onClick={onTopup}
        />
      ) : null}
    </div>
  );
}

function SourcingPlanCard({
  plan,
  currency,
  planCtaHref,
}: {
  plan: BillingSourcingPlanView;
  currency: BillingCurrencyDisplay;
  planCtaHref: (code: string) => string;
}) {
  const featured = plan.isFeatured;
  return (
    <div
      className={clsx(
        'relative flex min-w-0 flex-col rounded-2xl bg-white p-6 ring-1 transition',
        featured
          ? 'ring-2 ring-amber-400 shadow-xl shadow-amber-500/10'
          : 'ring-slate-200 hover:shadow-md hover:ring-slate-300'
      )}
    >
      {featured ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#072348] shadow-md">
          <Star className="h-2.5 w-2.5 fill-current" /> Đề xuất
        </span>
      ) : null}

      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
          {plan.description ? (
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{plan.description}</p>
          ) : null}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
          <Shield className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-4 min-w-0">
        <SalePrice
          list={plan.feeVnd}
          sale={plan.promoPriceVnd}
          percent={plan.promoPercent}
          label={plan.promoLabel}
          currency={currency}
        />
        <p className="mt-1 text-[11px] text-slate-500">Phí dịch vụ / vị trí · 30 ngày</p>
        {currency.showReferenceUsd ? (
          <p className="mt-0.5 text-[10px] text-slate-400">
            {formatReferenceUsd(plan.promoPriceVnd && plan.promoPercent ? plan.promoPriceVnd : plan.feeVnd, currency)}
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-center">
        <QuotaItem label="Vị trí" value={plan.positionQuota} />
        <QuotaItem label="Lượt mở" value={plan.creditQuota ?? null} />
        <QuotaItem label="Điều chỉnh" value={plan.revisionQuota} />
        <QuotaItem label="Báo cáo" value={plan.searchRoundQuota} />
      </div>

      {/* Service scope */}
      <div className="mt-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Phạm vi dịch vụ
        </p>
        <ul className="space-y-1.5">
          {ALL_SCOPES.map((s) => {
            const included = plan.serviceScope.includes(s);
            return (
              <li
                key={s}
                className={clsx(
                  'flex items-center gap-1.5 text-[12px]',
                  included ? 'text-slate-700' : 'text-slate-400 line-through'
                )}
              >
                {included ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <X className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                )}
                <span>{SCOPE_LABEL[s]}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <Link
        href={planCtaHref(plan.code)}
        className={clsx(
          'mt-5 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-bold transition',
          featured
            ? 'bg-amber-500 text-[#072348] hover:bg-amber-400'
            : 'bg-[#072348] text-white hover:bg-[#0d3b80]'
        )}
      >
        {planCtaHref(plan.code).startsWith('/recruiter') ? 'Thanh toán' : 'Chọn gói'}{' '}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function QuotaItem({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums text-[#072348]">
        {value == null ? '∞' : value}
      </p>
    </div>
  );
}

// ============================================================================
// CREDIT TOP-UP
// ============================================================================
function CreditTopupView({
  topups,
  currency,
  topupCtaHref,
  page,
}: {
  topups: BillingCreditTopupView[];
  currency: BillingCurrencyDisplay;
  topupCtaHref: (id: string) => string;
  page: BillingPageContentView;
}) {
  return (
    <div>
      <div className="mb-8 text-center">
        <h2 id="credit" className="text-2xl font-bold text-[#072348] sm:text-3xl scroll-mt-20">
          {page.creditTitle}
        </h2>
        <p className="mt-2 text-sm text-slate-500">{page.creditSubtitle}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 md:grid-cols-2">
        {topups
          .filter((t) => t.isActive)
          .map((t) => (
            <CreditTopupCard key={t.id} topup={t} currency={currency} topupCtaHref={topupCtaHref} />
          ))}
      </div>

      <p className="mt-6 text-center text-[12px] text-slate-500">
        <CreditCard className="mr-1 inline h-3.5 w-3.5" />
        Hỗ trợ thanh toán online và chuyển khoản. Hoá đơn VAT cho doanh nghiệp.
      </p>
    </div>
  );
}

function CreditTopupCard({
  topup,
  currency,
  topupCtaHref,
}: {
  topup: BillingCreditTopupView;
  currency: BillingCurrencyDisplay;
  topupCtaHref: (id: string) => string;
}) {
  const featured = topup.isFeatured;
  return (
    <div
      className={clsx(
        'relative flex min-w-0 flex-col rounded-2xl bg-white p-6 ring-1 transition',
        featured
          ? 'ring-2 ring-amber-400 shadow-xl shadow-amber-500/10'
          : 'ring-slate-200 hover:shadow-md hover:ring-slate-300'
      )}
    >
      {topup.badge || featured ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#072348] shadow-md">
          {topup.badge ?? 'Phổ biến'}
        </span>
      ) : null}

      <div className="flex items-center gap-2">
        <Coins className="h-5 w-5 text-amber-600" />
        <h3 className="text-lg font-bold text-slate-900">{topup.name}</h3>
      </div>
      <p className="mt-1 text-xs text-slate-500">{topup.creditCount} lượt mở hồ sơ</p>

      <div className="mt-4 min-w-0">
        <PlanPrice value={topup.priceVnd} currency={currency} />
        {currency.showReferenceUsd ? (
          <p className="text-[10px] text-slate-400">{formatReferenceUsd(topup.priceVnd, currency)}</p>
        ) : null}
        <p className="mt-1 text-[11px] text-slate-500">
          ≈{' '}
          <strong>
            {formatPriceVnd(topup.unitPriceVnd, { ...currency, decimalDigits: 0 })}
          </strong>{' '}
          / lượt
        </p>
      </div>

      <Link
        href={topupCtaHref(topup.id)}
        className={clsx(
          'mt-5 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-bold transition',
          featured
            ? 'bg-amber-500 text-[#072348] hover:bg-amber-400'
            : 'bg-[#072348] text-white hover:bg-[#0d3b80]'
        )}
      >
        Mua ngay <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

// ============================================================================
// TRUST ITEMS
// ============================================================================
function TrustItems({ page }: { page: BillingPageContentView }) {
  return (
    <section className="bg-white py-10 sm:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {page.trustItems.map((item, i) => {
            const Icon = TRUST_ICONS[i % TRUST_ICONS.length] ?? Shield;
            return <TrustItem key={`${item.title}-${i}`} icon={Icon} title={item.title} desc={item.desc} />;
          })}
        </div>
      </div>
    </section>
  );
}

function TrustItem({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="mt-3 text-sm font-bold text-slate-900">{title}</h3>
      <p className="mt-1 text-xs text-slate-500">{desc}</p>
    </div>
  );
}

// ============================================================================
// FAQ
// ============================================================================
function FAQSection({ page, vatPercent = null }: { page: BillingPageContentView; vatPercent?: number | null }) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <section id="faq" className="bg-slate-50 py-14 sm:py-20 scroll-mt-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-[#072348] sm:text-3xl">{page.faqTitle}</h2>
          <p className="mt-2 text-sm text-slate-500">{page.faqSubtitle}</p>
        </div>
        <div className="space-y-2">
          {page.faqItems.map((item, i) => {
            const open = openFaq === i;
            return (
              <div key={i} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpenFaq(open ? null : i)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
                  aria-expanded={open}
                >
                  <span className="text-sm font-semibold text-slate-900">{item.q}</span>
                  <ChevronDown
                    className={clsx(
                      'h-4 w-4 shrink-0 text-slate-400 transition',
                      open && 'rotate-180 text-slate-700'
                    )}
                  />
                </button>
                {open ? (
                  <div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-600">
                    {displayFaqAnswer(item.a, vatPercent)}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// FINAL CTA
// ============================================================================
function FinalCTA({ page, checkoutReady }: { page: BillingPageContentView; checkoutReady: boolean }) {
  return (
    <section className="bg-gradient-to-br from-[#072348] to-[#0d3b80] py-12 text-white">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-2xl font-bold sm:text-3xl">{page.finalCtaTitle}</h2>
        <p className="mt-2 text-sm text-slate-300">{page.finalCtaSubtitle}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={checkoutReady ? '/recruiter/billing' : '/register'}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-500 px-6 text-sm font-bold text-[#072348] shadow-lg shadow-amber-500/30 transition-colors hover:bg-amber-400"
          >
            {checkoutReady ? 'Gói của tôi' : 'Đăng ký miễn phí'} <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href={`mailto:${page.contactEmail}`}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/15"
          >
            Liên hệ sales <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// CROSS-SELL CARD
// ============================================================================
function CrossSellCard({
  title,
  desc,
  cta,
  onClick,
}: {
  title: string;
  desc: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-8 flex w-full items-center justify-between gap-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 p-5 text-left transition hover:border-amber-400 hover:bg-amber-50"
    >
      <div>
        <p className="text-sm font-bold text-amber-900">{title}</p>
        <p className="mt-0.5 text-xs text-amber-800/80">{desc}</p>
      </div>
      <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-[#072348]">
        {cta} <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

// ============================================================================
// SKELETON
// ============================================================================
function displayFaqAnswer(answer: string, percent?: number | null): string {
  if (!/Giá hiển thị chưa bao gồm VAT/i.test(answer) && !/VAT\s*10\s*%/i.test(answer)) return answer;
  if (percent == null) {
    return 'Giá hiển thị chưa bao gồm VAT. Thuế suất chưa đặt, thanh toán bằng giá đang hiển thị.';
  }
  return `Giá hiển thị chưa bao gồm VAT ${percent}%. Khi thanh toán cộng thêm ${percent}%.`;
}

function PricingSkeleton() {
  return (
    <section className="bg-gradient-to-br from-[#072348] to-[#0d3b80] py-16 text-white">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <div className="mx-auto h-3 w-32 animate-pulse rounded bg-white/20" />
        <div className="mx-auto mt-4 h-10 w-3/4 animate-pulse rounded bg-white/20" />
        <div className="mx-auto mt-3 h-4 w-2/3 animate-pulse rounded bg-white/20" />
      </div>
      <div className="mx-auto mt-12 grid max-w-5xl gap-4 px-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-72 animate-pulse rounded-2xl bg-white/10" />
        ))}
      </div>
    </section>
  );
}

function PricingLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <section className="bg-gradient-to-br from-[#072348] to-[#0d3b80] px-4 py-20 text-center text-white">
      <p className="text-lg font-semibold">Không tải được bảng giá</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-white/70">
        Máy chủ chưa trả cấu hình gói. Thử lại hoặc kiểm tra API billing.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#072348]"
      >
        Thử lại
      </button>
    </section>
  );
}

// ============================================================================
// STATS HELPER (plain function — not a hook, safe to call conditionally)
// ============================================================================
function computeStats(config: BillingPublicConfig) {
  const platformActive = config.platformPlans.filter((p) => p.isActive && p.code !== 'ENTERPRISE');
  const activeTopups = config.creditTopups.filter((p) => p.isActive);
  const cheapestTopup = [...activeTopups].sort((a, b) =>
    Number(BigInt(a.priceVnd) - BigInt(b.priceVnd)),
  )[0];
  const unitPrices = activeTopups.map((t) => Number(BigInt(t.unitPriceVnd)));
  const maxUnit = unitPrices.length ? Math.max(...unitPrices) : 0;
  const minUnit = unitPrices.length ? Math.min(...unitPrices) : 0;
  const savingPct =
    maxUnit > 0 && minUnit < maxUnit ? Math.round(((maxUnit - minUnit) / maxUnit) * 100) : undefined;
  return {
    planCount: config.platformPlans.length,
    sourcingCount: config.sourcingPlans.length,
    topupCount: config.creditTopups.length,
    cheapestTopup,
    savingPct,
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function PricingClient({
  config,
  context = 'public',
  embedded = false,
}: {
  config: BillingPublicConfig | null;
  context?: 'recruiter' | 'public';
  /** Trong app NTD: chỉ bảng giá + so sánh, không hero/SEO. */
  embedded?: boolean;
}) {
  const isRecruiter = context === 'recruiter' || embedded;
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    setHasToken(Boolean(tokenStore.get()));
  }, []);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: hasToken,
    retry: false,
    staleTime: 60_000,
  });
  const checkoutReady = embedded || isRecruiter || Boolean(me && NTD_ROLES.has(me.role));

  const { data: fetched, isLoading, refetch } = useQuery({
    queryKey: ['billing-public-config'],
    queryFn: fetchPublicBillingConfig,
    enabled: embedded || !config,
    staleTime: embedded ? 0 : 60_000,
    refetchOnWindowFocus: embedded,
    refetchOnMount: embedded ? 'always' : true,
    retry: 1,
  });
  const resolved = embedded ? (fetched ?? null) : (config ?? fetched ?? null);

  /** NTD đã login → trang thanh toán / billing. Khách → đăng ký. */
  const planCtaHref = (code: string) =>
    checkoutReady
      ? `/recruiter/billing/upgrade?plan=${encodeURIComponent(code)}`
      : `/register?plan=${encodeURIComponent(code)}`;
  const freeCtaHref = () => (checkoutReady ? '/recruiter/billing' : '/register');
  const page = resolved?.pageContent ?? DEFAULT_BILLING_PAGE_CONTENT;
  const vatPercent = resolved?.vatPercent ?? null;
  const enterpriseCtaHref = () =>
    checkoutReady ? '/recruiter/billing?plan=ENTERPRISE' : `mailto:${page.contactEmail}`;
  const canRequestEnterprise = Boolean(
    me &&
      (me.role === UserRole.Recruiter || me.role === UserRole.HiringManager || me.role === UserRole.CompanyAdmin),
  );
  /** Top-up: dùng id vì view không có code. */
  const topupCtaHref = (id: string) =>
    checkoutReady ? `/recruiter/billing/topup?topup=${encodeURIComponent(id)}` : '/register';
  const sourcingCtaHref = (code: string) =>
    checkoutReady
      ? `/recruiter/billing/sourcing?plan=${encodeURIComponent(code)}`
      : `/register?plan=${encodeURIComponent(code)}`;

  // Tab state — hooks must come before any conditional returns
  const [tab, setTab] = useState<PricingTab>('platform');
  const skipTabScroll = useRef(true);

  const switchTab = (next: PricingTab) => {
    setTab(next);
  };

  useEffect(() => {
    if (embedded) return;
    if (skipTabScroll.current) {
      skipTabScroll.current = false;
      return;
    }
    const id = tab === 'platform' ? 'pricing' : tab;
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [tab, embedded]);

  // Compute stats after hooks, then early-return if no config
  const stats = resolved ? computeStats(resolved) : null;

  if (!resolved) {
    if (isLoading) return <PricingSkeleton />;
    return <PricingLoadError onRetry={() => void refetch()} />;
  }

  const cur = resolved.currency;
  const enterprise = resolved.platformPlans.find((p) => p.code === 'ENTERPRISE' && p.isActive);

  if (embedded) {
    return (
      <div className="space-y-8">
        <SectionNav
          isRecruiter={false}
          embedded
          tab={tab}
          onTabChange={switchTab}
          page={page}
        />
        <section>
          {tab === 'platform' ? (
            <PlatformPlansView
              plans={resolved.platformPlans}
              currency={cur}
              enterprise={enterprise}
              onSourcing={() => setTab('sourcing')}
              onTopup={() => setTab('credit')}
              isRecruiter
              checkoutReady
              planCtaHref={planCtaHref}
              freeCtaHref={freeCtaHref}
              enterpriseCtaHref={enterpriseCtaHref}
              canRequestEnterprise={canRequestEnterprise}
              page={page}
            />
          ) : tab === 'sourcing' ? (
            <SourcingPlansView
              plans={resolved.sourcingPlans}
              currency={cur}
              onTopup={() => setTab('credit')}
              isRecruiter
              planCtaHref={sourcingCtaHref}
              page={page}
            />
          ) : (
            <CreditTopupView
              topups={resolved.creditTopups}
              currency={cur}
              topupCtaHref={topupCtaHref}
              page={page}
            />
          )}
        </section>
        <CompareSection
          platformPlans={resolved.platformPlans}
          sourcingPlans={resolved.sourcingPlans}
          topups={resolved.creditTopups}
          currency={cur}
          page={page}
        />
      </div>
    );
  }

  return (
    <>
      {/* TOP NAV (public only) */}
      {!isRecruiter && <TopNav checkoutReady={checkoutReady} />}

      {/* HERO */}
      {isRecruiter ? <HeroRecruiter page={page} /> : <HeroPublic stats={stats} page={page} checkoutReady={checkoutReady} />}

      {/* SECTION NAV */}
      <SectionNav isRecruiter={isRecruiter} tab={tab} onTabChange={switchTab} page={page} />

      {/* CONTENT */}
      <section className="bg-slate-50 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {tab === 'platform' ? (
            <PlatformPlansView
              plans={resolved.platformPlans}
              currency={cur}
              enterprise={enterprise}
              onSourcing={() => setTab('sourcing')}
              onTopup={() => setTab('credit')}
              isRecruiter={isRecruiter}
              checkoutReady={checkoutReady}
              planCtaHref={planCtaHref}
              freeCtaHref={freeCtaHref}
              enterpriseCtaHref={enterpriseCtaHref}
              canRequestEnterprise={canRequestEnterprise}
              page={page}
            />
          ) : tab === 'sourcing' ? (
            <SourcingPlansView
              plans={resolved.sourcingPlans}
              currency={cur}
              onTopup={() => setTab('credit')}
              isRecruiter={isRecruiter}
              planCtaHref={sourcingCtaHref}
              page={page}
            />
          ) : (
            <CreditTopupView
              topups={resolved.creditTopups}
              currency={cur}
              topupCtaHref={topupCtaHref}
              page={page}
            />
          )}
        </div>
      </section>

      {/* FEATURES (public only) */}
      {!isRecruiter && <FeaturesSection page={page} />}

      {/* COMPARE (public only) */}
      {!isRecruiter && (
        <CompareSection
          platformPlans={resolved.platformPlans}
          sourcingPlans={resolved.sourcingPlans}
          topups={resolved.creditTopups}
          currency={cur}
          page={page}
        />
      )}

      {/* HOW IT WORKS (public only) */}
      {!isRecruiter && <HowItWorksSection page={page} />}

      {/* TRUST */}
      <TrustItems page={page} />

      {/* FAQ (public only) */}
      {!isRecruiter && <FAQSection page={page} vatPercent={vatPercent} />}

      {/* CONTACT CTA (public only) */}
      {!isRecruiter && <ContactCTASection page={page} />}

      {/* FINAL CTA */}
      <FinalCTA page={page} checkoutReady={checkoutReady} />

      {/* FOOTER MINI (public only) */}
      {!isRecruiter && <FooterMini page={page} />}

      {/* FLOATING ZALO FAB (public only) */}
      {!isRecruiter && <ZaloFAB page={page} />}

      {/* MOBILE BOTTOM BAR (public only) */}
      {!isRecruiter && <MobileBottomBar page={page} />}

      {/* Bottom padding for mobile nav */}
      {!isRecruiter && <div className="h-16 lg:hidden" aria-hidden="true" />}
    </>
  );
}
