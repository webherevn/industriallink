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
  SourcingScopeLine,
} from '@industriallink/contracts';
import {
  DEFAULT_BILLING_PAGE_CONTENT,
  DEFAULT_SOURCING_SCOPE_LINES,
  UserRole,
} from '@industriallink/contracts';
import { fetchPublicBillingConfig } from '@/lib/admin-billing';
import { tokenStore } from '@/lib/api';
import { fetchMe } from '@/lib/auth';
import { formatPriceVnd, formatReferenceUsd } from '@/lib/format-billing';
import {
  PRICING_BRAND,
  PRICING_HEADING_CONTEXT,
  normalizePricingBrand,
  normalizePricingConfig,
  normalizePricingPage,
  displayFeatureLines,
  platformJobSentence,
  pricingPlatformFact,
} from '@/lib/pricing-catalog';
import { EnterpriseConsultButton } from './enterprise-consult-button';
import { BrandMark } from './brand-logo';
import { CompareSection } from './pricing-compare';

const NTD_ROLES = new Set<string>([
  UserRole.Recruiter,
  UserRole.HiringManager,
  UserRole.CompanyAdmin,
  UserRole.SuperAdmin,
]);

function scopeLinesOf(plan: BillingSourcingPlanView): SourcingScopeLine[] {
  if (plan.scopeItems?.length) return plan.scopeItems;
  const on = new Set(plan.serviceScope);
  return DEFAULT_SOURCING_SCOPE_LINES.map((line) => ({ ...line, included: on.has(line.code) }));
}

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
  className,
}: {
  value: string;
  currency: BillingCurrencyDisplay;
  className?: string;
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
    <p className={clsx('flex min-w-0 max-w-full flex-nowrap items-baseline gap-0.5', className ?? PRICE_TEXT)}>
      {symbolBefore ? <span className="shrink-0 text-[0.72em]">{symbol}</span> : null}
      <span className="min-w-0 tabular-nums">{amount}</span>
      {symbolAfter ? <span className="shrink-0 text-[0.72em]">{symbol}</span> : null}
    </p>
  );
}

function PlanPriceLabel({ children, className }: { children: string; className?: string }) {
  return <p className={className ?? PRICE_TEXT}>{children}</p>;
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
  priceClassName,
  stacked = false,
}: {
  list: string;
  sale?: string | null;
  percent?: number | null;
  label?: string | null;
  currency: BillingCurrencyDisplay;
  priceClassName?: string;
  /** Giữ chỗ giá gạch và nhãn giảm để các cột thẳng hàng. */
  stacked?: boolean;
}) {
  const onSale = Boolean(percent && percent > 0 && sale && sale !== list);
  return (
    <div>
      {onSale ? (
        <del className="block h-4 text-xs tabular-nums text-slate-400 line-through">
          <span className="sr-only">Giá gốc: </span>
          {formatPriceVnd(list, currency)}
        </del>
      ) : stacked ? (
        <p className="h-4" aria-hidden="true" />
      ) : null}
      {onSale ? (
        <ins className="block no-underline">
          <span className="sr-only">Giá ưu đãi hiện tại: </span>
          <PlanPrice value={sale!} currency={currency} className={priceClassName} />
        </ins>
      ) : (
        <PlanPrice value={list} currency={currency} className={priceClassName} />
      )}
      {stacked || onSale ? (
        onSale ? (
          <p className="mt-1 inline-flex h-5 items-center rounded-full bg-rose-50 px-2 text-[10px] font-bold text-rose-700">
            {label ?? `Giảm ${percent}%`}
          </p>
        ) : (
          <p className="mt-1 h-5" />
        )
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

/** Giữ cả ba nhóm gói trong HTML. Đổi tab chỉ ẩn, không gỡ khỏi DOM. */
function PricingH2({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <h2 id={id} className={className}>
      {children}
      <span className="sr-only">{PRICING_HEADING_CONTEXT}</span>
    </h2>
  );
}

function PricingTabPane({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <div hidden={!active} aria-hidden={!active}>
      {children}
    </div>
  );
}

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
    <section id="features" aria-labelledby="features-title" className="bg-white py-14 sm:py-20 scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10 text-center">
          <PricingH2 id="features-title" className="text-2xl font-bold text-[#072348] sm:text-3xl">
            {page.featuresTitle}
          </PricingH2>
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
      aria-labelledby="how-title"
      className="relative overflow-hidden bg-gradient-to-br from-[#072348] to-[#0d3b80] py-14 text-white sm:py-20 scroll-mt-20"
    >
      <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10 text-center">
          <PricingH2 id="how-title" className="text-2xl font-bold sm:text-3xl">
            {page.howTitle}
          </PricingH2>
          <p className="mt-2 text-sm text-slate-300">{page.howSubtitle}</p>
        </div>

        <dl className="grid gap-6 lg:grid-cols-3">
          {page.howSteps.map((step, i) => (
            <div key={`${step.title}-${i}`} className="relative">
              {i < page.howSteps.length - 1 && (
                <div className="absolute -right-3 top-6 hidden text-slate-600 lg:block" aria-hidden="true">
                  <ArrowRight className="h-5 w-5" />
                </div>
              )}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                <span className="text-4xl font-bold text-amber-400">{String(i + 1).padStart(2, '0')}</span>
                <dt className="mt-3 text-base font-bold">{step.title}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-slate-300">{step.desc}</dd>
              </div>
            </div>
          ))}
        </dl>

        <p className="mt-8 text-center text-sm text-slate-300">{page.howFooter}</p>
      </div>
    </section>
  );
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
    <section id="contact" aria-labelledby="contact-title" className="bg-white py-14 sm:py-20 scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#072348] to-[#0d3b80] p-8 text-white sm:p-12">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto max-w-2xl text-center">
            <PricingH2 id="contact-title" className="text-2xl font-bold sm:text-3xl">
              {page.contactTitle}
            </PricingH2>
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

const PROMO_END = new Date('2027-10-23T23:59:59+07:00').getTime();

function LaunchCountdown({ note }: { note: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const left = Math.max(0, PROMO_END - now);
  const parts = [
    { label: 'Ngày', value: Math.floor(left / 86_400_000) },
    { label: 'Giờ', value: Math.floor((left % 86_400_000) / 3_600_000) },
    { label: 'Phút', value: Math.floor((left % 3_600_000) / 60_000) },
    { label: 'Giây', value: Math.floor((left % 60_000) / 1000) },
  ];
  return (
    <div className="mx-auto mt-4 max-w-3xl rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-amber-50 px-4 py-4 shadow-[0_10px_30px_-18px_rgba(190,18,60,0.65)]">
      <p className="text-sm font-semibold text-rose-800">{note}</p>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-rose-500">
        Kết thúc sau
      </p>
      <div className="mt-2 flex justify-center gap-2 sm:gap-3">
        {parts.map((part) => (
          <div key={part.label} className="min-w-[4.5rem] rounded-xl bg-[#072348] px-2 py-2.5 text-white shadow-md sm:min-w-[5.75rem]">
            <p className="text-3xl font-black tabular-nums leading-none sm:text-4xl">
              {String(part.value).padStart(2, '0')}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
              {part.label}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-rose-700/80">Đến 23/10/2027</p>
    </div>
  );
}

// ============================================================================
// PLATFORM PLANS
// ============================================================================
const TOP_PLAN_CODES = ['KHAM_PHA', 'TIN_DANG', 'TIN_DANG_PLUS'] as const;
const BOTTOM_PLAN_CODES = ['DOANH_NGHIEP', 'ENTERPRISE'] as const;

function takePlans(plans: BillingPlatformPlanView[], codes: readonly string[]) {
  return codes
    .map((code) => plans.find((plan) => plan.code === code))
    .filter((plan): plan is BillingPlatformPlanView => Boolean(plan));
}

function PlatformPlansView({
  plans,
  currency,
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
  const known = new Set<string>([...TOP_PLAN_CODES, ...BOTTOM_PLAN_CODES]);
  const top = takePlans(visible, TOP_PLAN_CODES);
  const bottom = takePlans(visible, BOTTOM_PLAN_CODES);
  const rest = visible.filter((plan) => !known.has(plan.code));
  const cardProps = {
    currency,
    isRecruiter,
    checkoutReady,
    planCtaHref,
    freeCtaHref,
    enterpriseCtaHref,
    canRequestEnterprise,
  };

  return (
    <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-20">
      {/* Section header */}
      <div className="mb-8 text-center">
        <PricingH2 id="pricing-title" className="text-2xl font-bold text-[#072348] sm:text-3xl">
          {page.platformTitle}
        </PricingH2>
        <p className="mt-2 text-sm text-slate-500">{page.platformSubtitle}</p>
        {visible.some((p) => p.promoPercent) ? (
          <LaunchCountdown
            note="Khuyến mại HOT ngày ra mắt: Tin đăng, Tin đăng Plus và Doanh nghiệp giảm 50%."
          />
        ) : null}
      </div>

      <div className="grid min-w-0 items-stretch gap-5 pt-4 md:grid-cols-3">
        {top.map((p) => (
          <PlatformPlanCard key={p.id} plan={p} {...cardProps} />
        ))}
      </div>
      {bottom.length > 0 ? (
        <div className="mt-5 grid min-w-0 items-stretch gap-5 md:grid-cols-2">
          {bottom.map((p) => (
            <PlatformPlanCard key={p.id} plan={p} roomy {...cardProps} />
          ))}
        </div>
      ) : null}
      {rest.length > 0 ? (
        <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-3">
          {rest.map((p) => (
            <PlatformPlanCard key={p.id} plan={p} {...cardProps} />
          ))}
        </div>
      ) : null}

      {/* Cross-sell */}
      {!isRecruiter ? (
        <CrossSellCard
          title={`Cần ${PRICING_BRAND} tìm giúp?`}
          desc="Dịch vụ Săn nhân sự — chúng tôi tìm và sàng lọc giúp bạn."
          cta="Xem gói Săn"
          onClick={onSourcing}
        />
      ) : null}
    </section>
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
  roomy = false,
}: {
  plan: BillingPlatformPlanView;
  currency: BillingCurrencyDisplay;
  isRecruiter: boolean;
  checkoutReady: boolean;
  planCtaHref: (code: string) => string;
  freeCtaHref: () => string;
  enterpriseCtaHref: () => string;
  canRequestEnterprise: boolean;
  roomy?: boolean;
}) {
  const isFree = plan.code === 'KHAM_PHA';
  const isEnterprise = plan.code === 'ENTERPRISE';
  const featured = plan.code === 'TIN_DANG_PLUS';
  const priceClass = roomy
    ? 'font-bold leading-none tracking-tight text-[#072348] text-[2rem] md:text-5xl'
    : 'font-bold leading-none tracking-tight text-[#072348] text-[1.7rem] md:text-[2rem]';
  const rows = displayFeatureLines(plan);
  const ctaClass = clsx(
    'inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-bold transition',
    featured
      ? 'bg-[#E8872A] text-white shadow-[0_10px_20px_-10px_rgba(232,135,42,0.9)] hover:bg-[#d9781f]'
      : isFree
        ? 'bg-slate-100 text-slate-800 hover:bg-slate-200'
        : 'bg-[#072348] text-white shadow-[0_10px_20px_-12px_rgba(7,35,72,0.7)] hover:bg-[#0d3b80]',
  );

  return (
    <div
      className={clsx(
        'relative flex min-w-0 flex-col rounded-2xl border bg-white transition',
        roomy ? 'p-6 sm:p-7' : 'p-5',
        featured
          ? 'z-10 border-amber-200 bg-gradient-to-b from-amber-50/90 via-white to-white shadow-[0_22px_44px_-24px_rgba(232,135,42,0.65)]'
          : 'border-slate-200/90 shadow-[0_10px_28px_-18px_rgba(7,35,72,0.35)] hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-20px_rgba(7,35,72,0.4)]',
      )}
    >
      {featured ? (
        <span className="absolute -top-3.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[#072348] px-3 py-1 text-[11px] font-semibold tracking-wide text-white shadow-[0_8px_18px_-8px_rgba(7,35,72,0.7)]">
          <Star className="h-3 w-3 fill-amber-300 text-amber-300" />
          Gói phổ biến
        </span>
      ) : null}

      <h3 className={clsx('font-bold tracking-tight text-[#072348]', roomy ? 'text-2xl' : 'text-lg')}>{plan.name}</h3>
      <p className="mt-1 line-clamp-2 min-h-10 text-[13px] leading-5 text-slate-500">
        {pricingPlatformFact(plan).description || '\u00a0'}
      </p>

      <div className="mt-4 flex min-h-[7.5rem] flex-col justify-end">
        {isEnterprise ? (
          <div>
            <p className="h-4" />
            <PlanPriceLabel className={priceClass}>Báo giá</PlanPriceLabel>
            <p className="mt-1 h-5" />
          </div>
        ) : isFree ? (
          <div>
            <p className="h-4" />
            <PlanPriceLabel className={priceClass}>Miễn phí</PlanPriceLabel>
            <p className="mt-1 h-5" />
          </div>
        ) : (
          <SalePrice
            list={plan.priceVnd}
            sale={plan.promoPriceVnd}
            percent={plan.promoPercent}
            label={plan.promoLabel}
            currency={currency}
            priceClassName={priceClass}
            stacked
          />
        )}
        <PlanPriceMeta>
          {isEnterprise
            ? 'Theo hợp đồng'
            : isFree
              ? `${plan.durationDays ?? 14} ngày · ${platformJobSentence(plan)}`
              : `${UNIT_LABEL[plan.billingUnit]}${plan.durationDays ? ` · ${plan.durationDays} ngày` : ''}`}
        </PlanPriceMeta>
        <p className="min-h-4 text-[10px] leading-4 text-slate-400">
          {!isEnterprise && !isFree && currency.showReferenceUsd
            ? formatReferenceUsd(
                plan.promoPriceVnd && plan.promoPercent ? plan.promoPriceVnd : plan.priceVnd,
                currency,
              )
            : '\u00a0'}
        </p>
      </div>

      {isEnterprise && canRequestEnterprise ? (
        <EnterpriseConsultButton
          className={clsx(ctaClass, 'mt-4 disabled:opacity-60')}
          label="Liên hệ tư vấn"
          noteClassName="mt-2 text-xs text-slate-500"
          errorClassName="mt-2 text-xs text-rose-600"
        />
      ) : (
        <Link
          href={isEnterprise ? enterpriseCtaHref() : isFree ? freeCtaHref() : planCtaHref(plan.code)}
          className={clsx(ctaClass, 'mt-4')}
        >
          {isEnterprise
            ? 'Liên hệ tư vấn'
            : isFree
              ? checkoutReady || isRecruiter
                ? 'Vào gói của tôi'
                : 'Đăng ký miễn phí'
              : checkoutReady || isRecruiter
                ? 'Thanh toán'
                : 'Chọn gói'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}

      <ul className="mt-5 border-t border-slate-100 pt-2">
        {rows.map((row, index) => (
          <li
            key={`${index}-${row.label}`}
            aria-disabled={row.included ? undefined : true}
            className="flex h-10 items-center gap-2.5 border-b border-slate-100/80 last:border-0"
          >
            <span
              className={clsx(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                row.included ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-300',
              )}
              aria-hidden="true"
            >
              {row.included ? (
                <Check className="h-3 w-3" strokeWidth={2.6} />
              ) : (
                <X className="h-3 w-3" strokeWidth={2.6} />
              )}
            </span>
            <span
              title={row.label}
              className={clsx(
                'min-w-0 truncate text-[13px] leading-5',
                row.included ? 'font-medium text-slate-800' : 'text-slate-400 line-through decoration-slate-300',
              )}
            >
              <span className="sr-only">{row.included ? 'Bao gồm: ' : 'Không bao gồm: '}</span>
              {row.label}
            </span>
          </li>
        ))}
      </ul>
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
    <section aria-labelledby="sourcing">
      <div className="mb-8 text-center">
        <PricingH2 id="sourcing" className="text-2xl font-bold text-[#072348] sm:text-3xl scroll-mt-20">
          {page.sourcingTitle}
        </PricingH2>
        <p className="mt-2 text-sm text-slate-500">{page.sourcingSubtitle}</p>
        <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
          Muốn {PRICING_BRAND} hỗ trợ tìm kiếm theo yêu cầu? Chọn mức độ hỗ trợ phù hợp. Giá gói đã bao gồm quyền sử dụng nền tảng cần thiết cho vị trí; không thu lại toàn bộ phí Tin đăng cho cùng vị trí.
        </p>
        {plans.some((p) => p.promoPercent) ? (
          <LaunchCountdown note="Khuyến mại ra mắt: ba gói Tin săn giảm 30%. Mua thêm lượt không giảm giá." />
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
    </section>
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
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{normalizePricingBrand(plan.description)}</p>
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
          {scopeLinesOf(plan).map((line) => (
            <li
              key={line.code}
              aria-disabled={line.included ? undefined : true}
              className={clsx(
                'flex items-center gap-1.5 text-[12px]',
                line.included ? 'text-slate-700' : 'text-slate-400 line-through'
              )}
            >
              {line.included ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
              ) : (
                <X className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden="true" />
              )}
              <span>
                <span className="sr-only">{line.included ? 'Bao gồm: ' : 'Không bao gồm: '}</span>
                {line.label}
              </span>
            </li>
          ))}
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
    <section aria-labelledby="credit">
      <div className="mb-8 text-center">
        <PricingH2 id="credit" className="text-2xl font-bold text-[#072348] sm:text-3xl scroll-mt-20">
          {page.creditTitle}
        </PricingH2>
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
    </section>
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
  return (
    <section id="faq" aria-labelledby="faq-title" className="bg-slate-50 py-14 sm:py-20 scroll-mt-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="mb-8 text-center">
          <PricingH2 id="faq-title" className="text-2xl font-bold text-[#072348] sm:text-3xl">
            {page.faqTitle}
          </PricingH2>
          <p className="mt-2 text-sm text-slate-500">{page.faqSubtitle}</p>
        </div>
        <div className="space-y-2">
          {page.faqItems.map((item, i) => (
            <details key={i} className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-left text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                <span>{item.q}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180 group-open:text-slate-700" />
              </summary>
              <div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-600">
                {displayFaqAnswer(item.a, vatPercent)}
              </div>
            </details>
          ))}
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
    <section aria-labelledby="final-cta-title" className="bg-gradient-to-br from-[#072348] to-[#0d3b80] py-12 text-white">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <PricingH2 id="final-cta-title" className="text-2xl font-bold sm:text-3xl">
          {page.finalCtaTitle}
        </PricingH2>
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
  const resolvedRaw = embedded ? (fetched ?? null) : (config ?? fetched ?? null);
  const resolved = resolvedRaw ? normalizePricingConfig(resolvedRaw) : null;

  /** NTD đã login → trang thanh toán / billing. Khách → đăng ký. */
  const planCtaHref = (code: string) =>
    checkoutReady
      ? `/recruiter/billing/upgrade?plan=${encodeURIComponent(code)}`
      : `/register?plan=${encodeURIComponent(code)}`;
  const freeCtaHref = () => (checkoutReady ? '/recruiter/billing' : '/register');
  const page = normalizePricingPage(resolved?.pageContent ?? DEFAULT_BILLING_PAGE_CONTENT);
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
          <PricingTabPane active={tab === 'platform'}>
            <PlatformPlansView
              plans={resolved.platformPlans}
              currency={cur}
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
          </PricingTabPane>
          <PricingTabPane active={tab === 'sourcing'}>
            <SourcingPlansView
              plans={resolved.sourcingPlans}
              currency={cur}
              onTopup={() => setTab('credit')}
              isRecruiter
              planCtaHref={sourcingCtaHref}
              page={page}
            />
          </PricingTabPane>
          <PricingTabPane active={tab === 'credit'}>
            <CreditTopupView
              topups={resolved.creditTopups}
              currency={cur}
              topupCtaHref={topupCtaHref}
              page={page}
            />
          </PricingTabPane>
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
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <PricingTabPane active={tab === 'platform'}>
            <PlatformPlansView
              plans={resolved.platformPlans}
              currency={cur}
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
          </PricingTabPane>
          <PricingTabPane active={tab === 'sourcing'}>
            <SourcingPlansView
              plans={resolved.sourcingPlans}
              currency={cur}
              onTopup={() => setTab('credit')}
              isRecruiter={isRecruiter}
              planCtaHref={sourcingCtaHref}
              page={page}
            />
          </PricingTabPane>
          <PricingTabPane active={tab === 'credit'}>
            <CreditTopupView
              topups={resolved.creditTopups}
              currency={cur}
              topupCtaHref={topupCtaHref}
              page={page}
            />
          </PricingTabPane>
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
