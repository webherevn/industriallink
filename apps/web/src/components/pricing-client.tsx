'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowRight,
  Banknote,
  BarChart3,
  Building2,
  Check,
  ChevronDown,
  Coins,
  Contact2,
  CreditCard,
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
  Tag,
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
  platformHighlightStats,
  platformPriceMetaText,
  pricingPlatformFact,
} from '@/lib/pricing-catalog';
import { EnterpriseConsultButton } from './enterprise-consult-button';
import { BrandMark } from './brand-logo';
import { CompareSection } from './pricing-compare';
import { SiteFooter } from './site-footer';

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

/** Cỡ chữ giá đồng nhất cho mọi thẻ gói tiêu chuẩn */
const PRICE_TEXT =
  'font-extrabold leading-none tracking-tight text-[#072348] text-2xl sm:text-[1.75rem]';

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
    <p className={clsx('flex min-w-0 max-w-full flex-nowrap items-baseline gap-1', className ?? PRICE_TEXT)}>
      {symbolBefore ? <span className="shrink-0 text-[0.68em] font-bold text-slate-600">{symbol}</span> : null}
      <span className="min-w-0 tabular-nums">{amount}</span>
      {symbolAfter ? <span className="shrink-0 text-[0.68em] font-bold text-slate-600">{symbol}</span> : null}
    </p>
  );
}

function PlanPriceLabel({ children, className }: { children: string; className?: string }) {
  return <p className={className ?? PRICE_TEXT}>{children}</p>;
}

function PlanPriceMeta({ children }: { children?: ReactNode }) {
  return <p className="mt-1.5 min-h-[16px] text-xs font-medium leading-4 text-slate-500">{children ?? '\u00a0'}</p>;
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
  /** Giữ chỗ giá gạch và nhãn giảm để các cột thẳng hàng tuyệt đối. */
  stacked?: boolean;
}) {
  const onSale = Boolean(percent && percent > 0 && sale && sale !== list);
  return (
    <div>
      {onSale ? (
        <div className="mb-1 flex h-5 items-center gap-1.5">
          <del className="text-xs font-medium tabular-nums text-slate-400 line-through">
            <span className="sr-only">Giá gốc: </span>
            {formatPriceVnd(list, currency)}
          </del>
          <span className="inline-flex items-center rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-inset ring-rose-200/70">
            {label ?? `-${percent}%`}
          </span>
        </div>
      ) : stacked ? (
        <div className="mb-1 h-5" aria-hidden="true" />
      ) : null}
      {onSale ? (
        <ins className="block no-underline">
          <span className="sr-only">Giá ưu đãi hiện tại: </span>
          <PlanPrice value={sale!} currency={currency} className={priceClassName} />
        </ins>
      ) : (
        <PlanPrice value={list} currency={currency} className={priceClassName} />
      )}
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
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <BrandMark size={32} />

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Điều hướng trang">
          {[
            ['#pricing', 'Bảng giá dịch vụ'],
            ['#compare', 'So sánh chi tiết'],
            ['#how', 'Cơ chế tính phí'],
            ['#features', 'Năng lực nền tảng'],
            ['#faq', 'Câu hỏi thường gặp'],
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

        <div className="hidden items-center gap-2.5 lg:flex">
          {checkoutReady ? null : (
            <Link
              href="/login"
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Đăng nhập
            </Link>
          )}
          <Link
            href={startHref}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-[#072348] shadow-sm transition-colors hover:bg-amber-400"
          >
            {startLabel}
          </Link>
        </div>

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

      {menuOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-1">
            {[
              ['#pricing', 'Bảng giá dịch vụ'],
              ['#compare', 'So sánh chi tiết'],
              ['#how', 'Cơ chế tính phí'],
              ['#features', 'Năng lực nền tảng'],
              ['#faq', 'Câu hỏi thường gặp'],
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
              className="rounded-lg bg-amber-500 px-3 py-2 text-center text-sm font-bold text-[#072348] transition-colors hover:bg-amber-400"
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
// HERO (PUBLIC & RECRUITER) + INTEGRATED TRUST COMMITMENTS
// ============================================================================
function HeroPublic({
  stats,
  page,
  checkoutReady,
  onSelectTab,
}: {
  stats: ReturnType<typeof computeStats> | null;
  page: BillingPageContentView;
  checkoutReady: boolean;
  onSelectTab?: (tab: PricingTab) => void;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#072348] via-[#0a2d5e] to-[#0d3b80] pb-12 pt-12 text-white sm:pb-16 sm:pt-16">
      <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-amber-500/15 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl" aria-hidden="true" />

      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-8">
          {/* Left Column: Headline & Primary CTAs (matches HomeHero style) */}
          <div className="home-reasons-head text-center lg:col-span-7 lg:text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-500/10 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200">
              <Sparkles className="home-reasons-glyph h-3 w-3" /> {page.heroBadge}
            </span>
            <span
              className="home-reasons-mark mx-auto mt-3 block h-1 w-12 origin-center rounded-full bg-[#E8872A] lg:mx-0 lg:origin-left"
              aria-hidden="true"
            />

            <h1 className="mt-4 text-3xl font-extrabold leading-[1.14] tracking-tight sm:text-5xl">
              <span className="block">{page.heroHeading}</span>
              <span className="bg-gradient-to-r from-amber-300 to-amber-200 bg-clip-text text-transparent">
                {page.heroHeadingAccent}
              </span>
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg lg:mx-0">
              {page.heroSubtitle}
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Link
                href={checkoutReady ? '/recruiter/billing' : '/register'}
                className="group inline-flex h-12 items-center gap-2 rounded-2xl bg-[#E8872A] px-6 text-sm font-bold text-white shadow-[0_12px_24px_-10px_rgba(232,135,42,0.85)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#d06f18]"
              >
                {checkoutReady ? 'Quản lý gói của tôi' : page.heroCtaPrimary}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <a
                href="#how"
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:bg-white/15"
              >
                <Play className="h-4 w-4 text-amber-300" /> {page.heroCtaSecondary}
              </a>
            </div>

            <p className="mt-5 text-xs font-medium text-slate-300/90 sm:text-sm">{page.heroSocialProof}</p>

            {stats && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-slate-300 lg:justify-start">
                <span>
                  <strong className="text-white">{stats.planCount}</strong> gói nền tảng
                </span>
                <span className="text-slate-500">·</span>
                <span>
                  <strong className="text-white">{stats.sourcingCount}</strong> gói Săn nhân sự
                </span>
                <span className="text-slate-500">·</span>
                <span>
                  <strong className="text-white">{stats.topupCount}</strong> mức Top-up Credit
                </span>
                {stats.savingPct && (
                  <>
                    <span className="text-slate-500">·</span>
                    <span>
                      Tiết kiệm đến <strong className="text-amber-300">{stats.savingPct}%</strong> đơn giá Credit
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Floating Dynamic Preview Cards (like HomeHero) */}
          <div className="home-reasons-item grid gap-3.5 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1" style={{ animationDelay: '140ms' }}>
            {/* Floating Card 1: AI Matching & Credit Mechanism */}
            <article className="home-hero-float-card rounded-2xl border border-white/15 bg-white/95 p-4 text-slate-800 shadow-[0_18px_42px_-18px_rgba(2,6,23,0.55)] backdrop-blur-md">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#072348]">
                  <Sparkles className="h-4 w-4 text-[#E8872A]" />
                  Cơ chế tính Credit thông minh
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  Minh bạch 100%
                </span>
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                  <span className="font-medium text-slate-600">Xem tổng quan điểm AI Matching</span>
                  <span className="font-extrabold text-emerald-600">Miễn phí (0đ)</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                  <span className="font-medium text-slate-600">Xem CV ứng viên tự nộp vào tin</span>
                  <span className="font-extrabold text-emerald-600">0 Credit</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-amber-50/70 px-3 py-2 text-xs">
                  <span className="font-medium text-slate-700">Chủ động mở CV tiềm năng</span>
                  <span className="font-extrabold text-[#072348]">1 – 2 Credit / CV</span>
                </div>
              </div>
            </article>

            {/* Floating Card 2: Quick Interactive Service Tier Jump */}
            <article
              className="home-hero-float-card rounded-2xl border border-white/15 bg-white/95 p-4 text-slate-800 shadow-[0_18px_42px_-18px_rgba(2,6,23,0.55)] backdrop-blur-md"
              style={{ animationDelay: '0.8s' }}
            >
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#072348]">
                3 Giải pháp linh hoạt theo nhu cầu
              </p>
              <div className="mt-2.5 grid gap-2">
                {[
                  {
                    id: 'platform' as const,
                    title: page.platformTitle,
                    desc: 'Tự đăng tin & khai thác kho CV bằng AI',
                    badge: stats?.maxPlatformPromo ? `-${stats.maxPlatformPromo}%` : '4 gói + Enterprise',
                  },
                  {
                    id: 'sourcing' as const,
                    title: page.sourcingTitle,
                    desc: 'Chuyên gia inlink săn & lọc ứng viên',
                    badge: stats?.maxSourcingPromo ? `-${stats.maxSourcingPromo}%` : 'Theo vị trí',
                  },
                  {
                    id: 'credit' as const,
                    title: page.creditTitle,
                    desc: 'Mua thêm lượt mở CV bảo lưu vĩnh viễn',
                    badge: stats?.savingPct ? `Tiết kiệm ${stats.savingPct}%` : 'Vô thời hạn',
                  },
                ].map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => onSelectTab?.(tier.id)}
                    className="home-audience-row flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-left transition hover:border-amber-300 hover:bg-amber-50/60"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-[#072348]">{tier.title}</p>
                      <p className="truncate text-[11px] text-slate-500">{tier.desc}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">
                      {tier.badge}
                    </span>
                  </button>
                ))}
              </div>
            </article>
          </div>
        </div>

        {/* Integrated 3 Trust Commitments Bar */}
        {page.trustItems.length > 0 && (
          <div className="mx-auto mt-10 grid max-w-6xl gap-3.5 border-t border-white/10 pt-8 sm:grid-cols-3 sm:gap-4">
            {page.trustItems.map((item, i) => {
              const Icon = TRUST_ICONS[i % TRUST_ICONS.length] ?? Shield;
              return (
                <div
                  key={`${item.title}-${i}`}
                  style={{ animationDelay: `${200 + i * 100}ms` }}
                  className="home-reasons-item home-stat-item flex items-start gap-3.5 rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3.5 backdrop-blur-sm"
                >
                  <div
                    className="home-reasons-glyph flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300"
                    style={{ animationDelay: `${i * 0.35}s` }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xs font-bold text-white sm:text-sm">{item.title}</h2>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-300">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function HeroRecruiter({ page }: { page: BillingPageContentView }) {
  return (
    <section className="border-b border-slate-200 bg-white py-6 sm:py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-600">
              {page.recruiterKicker}
            </p>
            <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight text-[#072348] sm:text-3xl">
              {page.recruiterHeading}
            </h1>
            <p className="mt-1 text-sm text-slate-500">{page.recruiterSubtitle}</p>
          </div>
          {page.trustItems.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {page.trustItems.map((item, i) => {
                const Icon = TRUST_ICONS[i % TRUST_ICONS.length] ?? Shield;
                return (
                  <span
                    key={`${item.title}-${i}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
                  >
                    <Icon className="h-3.5 w-3.5 text-amber-600" />
                    {item.title}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// SECTION NAV (3-TIER SERVICE SWITCHER)
// ============================================================================
type PricingTab = 'platform' | 'sourcing' | 'credit';

function planDomId(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function resolvePricingHash(
  rawHash: string,
): { tab: PricingTab; targetId: string; highlightId?: string } | null {
  const h = rawHash.replace(/^#/, '').trim().toLowerCase();
  if (!h) return null;
  if (['features', 'compare', 'how', 'faq', 'contact'].includes(h)) return null;

  const normalized = h.replace(/[-_]+/g, '');
  if (['nentang', 'goinentang', 'platform', 'pricing'].includes(normalized)) {
    return { tab: 'platform', targetId: 'nentang' };
  }
  if (['khampha', 'goikhampha'].includes(normalized)) {
    return { tab: 'platform', targetId: 'khampha', highlightId: 'khampha' };
  }
  if (['tindang', 'goitindang'].includes(normalized)) {
    return { tab: 'platform', targetId: 'tindang', highlightId: 'tindang' };
  }
  if (['tindangplus', 'goitindangplus'].includes(normalized)) {
    return { tab: 'platform', targetId: 'tindangplus', highlightId: 'tindangplus' };
  }
  if (['doanhnghiep', 'goidoanhnghiep'].includes(normalized)) {
    return { tab: 'platform', targetId: 'doanhnghiep', highlightId: 'doanhnghiep' };
  }
  if (['enterprise', 'goienterprise'].includes(normalized)) {
    return { tab: 'platform', targetId: 'enterprise', highlightId: 'enterprise' };
  }
  if (['tinsan', 'goisan', 'goisannhansu', 'sourcing'].includes(normalized)) {
    return { tab: 'sourcing', targetId: 'tinsan' };
  }
  if (normalized.startsWith('tinsan') || normalized.startsWith('sourcing')) {
    return { tab: 'sourcing', targetId: normalized, highlightId: normalized };
  }
  if (['credit', 'topup', 'topupcredit', 'napcredit'].includes(normalized)) {
    return { tab: 'credit', targetId: 'credit' };
  }
  return null;
}

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
  tab,
  onTabChange,
  page,
  stats,
  embedded = false,
}: {
  tab: PricingTab;
  onTabChange: (tab: PricingTab) => void;
  page: BillingPageContentView;
  stats: ReturnType<typeof computeStats> | null;
  embedded?: boolean;
}) {
  const items: Array<{
    id: PricingTab;
    label: string;
    badge?: string;
    Icon: typeof Package;
  }> = [
    {
      id: 'platform',
      label: page.platformTitle,
      badge: stats?.maxPlatformPromo ? `-${stats.maxPlatformPromo}%` : undefined,
      Icon: Package,
    },
    {
      id: 'sourcing',
      label: page.sourcingTitle,
      badge: stats?.maxSourcingPromo ? `-${stats.maxSourcingPromo}%` : undefined,
      Icon: Shield,
    },
    {
      id: 'credit',
      label: page.creditTitle,
      badge: stats?.savingPct ? `-${stats.savingPct}%` : undefined,
      Icon: Coins,
    },
  ];

  if (embedded) {
    return (
      <nav
        className="flex flex-wrap items-center gap-2"
        aria-label="Chuyển nhóm dịch vụ bảng giá"
      >
        <div className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-slate-200/90 bg-slate-100/90 p-1.5">
          {items.map(({ id, label, badge, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => onTabChange(id)}
                className={clsx(
                  'inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition-all sm:px-5 sm:text-sm',
                  active
                    ? 'bg-[#072348] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-[#072348]',
                )}
              >
                <Icon
                  className={clsx(
                    'h-4 w-4 shrink-0',
                    active ? 'text-amber-400' : 'text-slate-400',
                  )}
                />
                <span>{label}</span>
                {badge ? (
                  <span
                    className={clsx(
                      'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold leading-none',
                      active
                        ? 'bg-amber-400 text-[#072348]'
                        : 'bg-amber-100 text-amber-800',
                    )}
                  >
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  return (
    <nav
      className="sticky top-[57px] z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md"
      aria-label="Chuyển nhóm dịch vụ bảng giá"
    >
      <div className="relative mx-auto flex max-w-7xl items-center justify-center px-4 py-3 sm:px-6">
        <div className="inline-flex max-w-full flex-wrap items-center justify-center gap-1 rounded-full border border-slate-200/90 bg-slate-100/90 p-1.5 shadow-inner sm:gap-1.5">
          {items.map(({ id, label, badge, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => onTabChange(id)}
                className={clsx(
                  'group inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-bold transition-all sm:px-5 sm:py-2.5 sm:text-sm',
                  active
                    ? 'bg-[#072348] text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-[#072348]',
                )}
              >
                <Icon
                  className={clsx(
                    'h-4 w-4 shrink-0 transition-colors',
                    active
                      ? 'text-amber-400'
                      : 'text-slate-400 group-hover:text-[#072348]',
                  )}
                />
                <span>{label}</span>
                {badge ? (
                  <span
                    className={clsx(
                      'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold leading-none',
                      active
                        ? 'bg-amber-400 text-[#072348]'
                        : 'bg-amber-100/90 text-amber-800',
                    )}
                  >
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <a
          href="#contact"
          className="hidden shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50/80 px-3.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-[#072348] xl:absolute xl:right-6 xl:inline-flex"
        >
          <Phone className="h-3.5 w-3.5 text-amber-600" />
          {page.consultNavText}
        </a>
      </div>
    </nav>
  );
}

// ============================================================================
// PROMO COUNTDOWN & VAT RIBBON (COMPACT, PROFESSIONAL B2B STYLE)
// ============================================================================
function computePromoRemaining(nowMs: number) {
  const now = new Date(nowMs);
  // Chu kỳ ưu đãi theo đợt trong tháng (tự động gia hạn chu kỳ kế tiếp nếu dưới 2 ngày)
  let end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  if (end.getTime() - nowMs < 2 * 86_400_000) {
    end = new Date(now.getFullYear(), now.getMonth() + 1, 15, 23, 59, 59);
  }
  const diffSec = Math.max(0, Math.floor((end.getTime() - nowMs) / 1000));
  const days = Math.floor(diffSec / 86_400);
  const hours = Math.floor((diffSec % 86_400) / 3_600);
  const minutes = Math.floor((diffSec % 3_600) / 60);
  const seconds = diffSec % 60;
  return { days, hours, minutes, seconds };
}

function PromoRibbon({
  promoNote,
  vatPercent,
  showCountdown = false,
}: {
  promoNote?: string | null;
  vatPercent?: number | null;
  showCountdown?: boolean;
}) {
  const [remaining, setRemaining] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    if (!showCountdown) return;
    const update = () => setRemaining(computePromoRemaining(Date.now()));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [showCountdown]);

  const vatText =
    vatPercent != null
      ? `Giá chưa gồm VAT (${vatPercent}%) · Xuất hoá đơn GTGT đầy đủ`
      : 'Giá chưa gồm VAT · Hỗ trợ xuất hoá đơn GTGT doanh nghiệp';

  const pad = (v: number) => String(v).padStart(2, '0');

  if (showCountdown && promoNote) {
    const units = [
      { label: 'Ngày', value: remaining ? pad(remaining.days) : '05' },
      { label: 'Giờ', value: remaining ? pad(remaining.hours) : '14' },
      { label: 'Phút', value: remaining ? pad(remaining.minutes) : '38' },
      { label: 'Giây', value: remaining ? pad(remaining.seconds) : '24' },
    ];

    return (
      <div className="home-reasons-item mx-auto mt-6 max-w-5xl overflow-hidden rounded-2xl border border-[#123d73] bg-gradient-to-r from-[#072348] via-[#0b2f5c] to-[#113d73] px-4 py-3.5 text-white shadow-[0_16px_36px_-18px_rgba(7,35,72,0.55)] sm:px-6">
        <div className="flex flex-col items-center justify-between gap-3.5 lg:flex-row">
          {/* Left: Promo message & VAT */}
          <div className="flex flex-col items-center gap-1.5 text-center sm:flex-row sm:gap-3 sm:text-left">
            <span className="home-step-badge inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#072348] shadow-sm">
              <Tag className="h-3 w-3" /> Ưu đãi ra mắt
            </span>
            <div>
              <p className="text-xs font-bold text-white sm:text-sm">{promoNote}</p>
              <p className="mt-0.5 text-[11px] text-slate-300">{vatText}</p>
            </div>
          </div>

          {/* Right: Sleek Executive Countdown */}
          <div className="flex shrink-0 items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 backdrop-blur-sm">
            <span className="hidden text-[11px] font-semibold uppercase tracking-wider text-amber-200 sm:inline">
              Kết thúc sau
            </span>
            <div className="flex items-center gap-1.5" aria-label="Thời gian ưu đãi còn lại">
              {units.map((u, idx) => (
                <div key={u.label} className="flex items-center gap-1.5">
                  <div className="flex min-w-[2.9rem] flex-col items-center justify-center rounded-lg border border-amber-400/30 bg-[#061c38]/90 px-2 py-1 shadow-inner">
                    <span className="font-mono text-sm font-extrabold tabular-nums leading-none text-amber-300 sm:text-base">
                      {u.value}
                    </span>
                    <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-300">
                      {u.label}
                    </span>
                  </div>
                  {idx < units.length - 1 ? (
                    <span className="text-xs font-bold text-amber-400/70" aria-hidden="true">
                      :
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-reasons-item mx-auto mt-5 flex max-w-4xl flex-col items-center justify-between gap-2.5 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50/90 via-white to-amber-50/60 px-4 py-3 shadow-sm sm:flex-row sm:px-5">
      {promoNote ? (
        <div className="flex items-center gap-2 text-center sm:text-left">
          <span className="home-step-badge inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#072348]">
            <Tag className="h-3 w-3" /> Quyền lợi
          </span>
          <p className="text-xs font-semibold text-slate-800 sm:text-sm">{promoNote}</p>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <Shield className="h-4 w-4 text-amber-600" />
          <span>Chi phí minh bạch · Không tự động gia hạn khi hết chu kỳ</span>
        </div>
      )}
      <p className="shrink-0 text-[11px] font-medium text-slate-500">{vatText}</p>
    </div>
  );
}

// ============================================================================
// PLATFORM PLANS (4 + 1 ARCHITECTURE)
// ============================================================================
const STANDARD_PLAN_CODES = ['KHAM_PHA', 'TIN_DANG', 'TIN_DANG_PLUS', 'DOANH_NGHIEP'] as const;

function takePlans(plans: BillingPlatformPlanView[], codes: readonly string[]) {
  return codes
    .map((code) => plans.find((plan) => plan.code === code))
    .filter((plan): plan is BillingPlatformPlanView => Boolean(plan));
}

function buildPlatformPromoSummary(plans: BillingPlatformPlanView[]): string | null {
  const promoPlans = plans.filter((p) => p.promoPercent && p.promoPercent > 0);
  if (promoPlans.length === 0) return null;
  const maxPct = Math.max(...promoPlans.map((p) => p.promoPercent ?? 0));
  const names = promoPlans.map((p) => p.name).join(', ');
  return `Giảm đến ${maxPct}% cho gói ${names}`;
}

function PlatformPlansView({
  plans,
  currency,
  vatPercent,
  highlightedId,
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
  vatPercent: number | null;
  highlightedId?: string | null;
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
  const standardPlans = takePlans(visible, STANDARD_PLAN_CODES);
  const enterprisePlan = visible.find((p) => p.code === 'ENTERPRISE') ?? null;
  const known = new Set<string>([...STANDARD_PLAN_CODES, 'ENTERPRISE']);
  const rest = visible.filter((plan) => !known.has(plan.code));

  const hasExplicitFeatured = standardPlans.some((p) => p.isFeatured);
  const isPlanFeatured = (plan: BillingPlatformPlanView) =>
    hasExplicitFeatured ? Boolean(plan.isFeatured) : plan.code === 'TIN_DANG_PLUS';

  const promoNote = buildPlatformPromoSummary(visible);

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
    <section id="nentang" aria-labelledby="pricing-title" className="scroll-mt-36">
      <div id="pricing" className="home-reasons-head mb-8 text-center scroll-mt-36">
        <PricingH2 id="pricing-title" className="text-2xl font-bold text-[#072348] sm:text-3xl">
          {page.platformTitle}
        </PricingH2>
        <p className="mt-1.5 text-sm text-slate-500">{page.platformSubtitle}</p>
        <span className="home-reasons-mark mx-auto mt-3.5 block h-1 w-14 rounded-full bg-[#F08A24]" />
        <PromoRibbon promoNote={promoNote} vatPercent={vatPercent} showCountdown={Boolean(promoNote)} />
      </div>

      {/* Row 1: 4 Standard Plans on a uniform 4-column grid */}
      <div className="grid min-w-0 items-stretch gap-5 pt-3 md:grid-cols-2 xl:grid-cols-4">
        {standardPlans.map((p, idx) => {
          const domId = planDomId(p.code);
          return (
            <PlatformPlanCard
              key={p.id}
              domId={domId}
              index={idx}
              highlighted={highlightedId === domId}
              plan={p}
              featured={isPlanFeatured(p)}
              {...cardProps}
            />
          );
        })}
      </div>

      {/* Row 2: Full-width Horizontal Enterprise Banner */}
      {enterprisePlan ? (
        <div className="mt-6">
          <EnterprisePlanBanner
            domId="enterprise"
            highlighted={highlightedId === 'enterprise'}
            plan={enterprisePlan}
            {...cardProps}
          />
        </div>
      ) : null}

      {/* Extra custom plans if SuperAdmin adds more */}
      {rest.length > 0 ? (
        <div className="mt-6 grid min-w-0 items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
          {rest.map((p, idx) => {
            const domId = planDomId(p.code);
            return (
              <PlatformPlanCard
                key={p.id}
                domId={domId}
                index={idx}
                highlighted={highlightedId === domId}
                plan={p}
                featured={Boolean(p.isFeatured)}
                {...cardProps}
              />
            );
          })}
        </div>
      ) : null}

      {/* Cross-sell to Sourcing & Top-up */}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <CrossSellCard
          title={`Cần chuyên gia ${PRICING_BRAND} tìm & sàng lọc ứng viên giúp bạn?`}
          desc="Gói Săn nhân sự theo vị trí — đội ngũ inlink chủ động tiếp cận, phỏng vấn sơ bộ và bàn giao shortlist."
          cta="Xem gói Săn nhân sự"
          onClick={onSourcing}
        />
        <CrossSellCard
          title="Cần mua thêm lượt mở hồ sơ (Credit) dự phòng?"
          desc="Credit mua từ Top-up có hiệu lực vô thời hạn và được bảo lưu ngay cả khi gói nền tảng hết hạn."
          cta="Xem bảng giá Top-up Credit"
          onClick={onTopup}
        />
      </div>
    </section>
  );
}

function PlatformPlanCard({
  domId,
  highlighted = false,
  plan,
  featured,
  currency,
  isRecruiter,
  checkoutReady,
  planCtaHref,
  freeCtaHref,
  enterpriseCtaHref,
  canRequestEnterprise,
}: {
  domId?: string;
  index?: number;
  highlighted?: boolean;
  plan: BillingPlatformPlanView;
  featured: boolean;
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
  const rows = displayFeatureLines(plan);
  const ctaClass = clsx(
    'group/cta inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-bold transition-all',
    featured
      ? 'bg-amber-500 text-[#072348] shadow-md shadow-amber-500/20 hover:bg-amber-400'
      : isEnterprise
        ? 'border border-slate-200 bg-white text-[#072348] hover:bg-slate-50'
        : 'bg-[#072348] text-white shadow-sm hover:bg-[#0d3b80]',
  );
  const Mark = isFree ? Sparkles : Building2;

  return (
    <div
      id={domId}
      className={clsx(
        'home-solution-card relative flex min-w-0 scroll-mt-40 flex-col rounded-2xl border bg-white p-5 transition-all sm:p-6',
        highlighted
          ? 'z-10 border-amber-500 ring-4 ring-amber-400/50 shadow-[0_24px_48px_-16px_rgba(232,135,42,0.55)]'
          : featured
            ? 'z-10 border-amber-400 ring-2 ring-amber-400/30 shadow-[0_20px_40px_-20px_rgba(232,135,42,0.45)]'
            : 'border-slate-200/90 shadow-[0_8px_24px_-16px_rgba(7,35,72,0.18)] hover:border-slate-300',
      )}
    >
      {featured ? (
        <span className="home-step-badge absolute -top-3.5 left-6 inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#072348] shadow-sm">
          <Star className="h-3 w-3 fill-[#072348]" />
          Gói phổ biến nhất
        </span>
      ) : null}

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold uppercase tracking-tight text-[#072348]">
            {plan.name}
          </h3>
          <span className="mt-0.5 inline-block text-[11px] font-medium text-slate-400">
            {plan.billingUnit === 'per_month' ? 'Thuê bao theo tháng' : isFree ? 'Trải nghiệm nền tảng' : 'Tính theo từng tin (JD)'}
          </span>
        </div>
        <span
          className={clsx(
            'home-reasons-glyph flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            featured ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-[#072348]',
          )}
        >
          <Mark className="h-5 w-5" />
        </span>
      </div>

      <p className="mt-2.5 line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-slate-600">
        {pricingPlatformFact(plan).description || '\u00a0'}
      </p>

      {/* Price box — fixed height for strict horizontal alignment */}
      <div className="mt-4 flex min-h-[5.75rem] flex-col justify-end rounded-xl bg-slate-50/80 px-3.5 py-3">
        {isEnterprise ? (
          <div>
            <div className="mb-1 h-5" aria-hidden="true" />
            <PlanPriceLabel>Báo giá</PlanPriceLabel>
          </div>
        ) : isFree ? (
          <div>
            <div className="mb-1 h-5" aria-hidden="true" />
            <PlanPriceLabel>Miễn phí</PlanPriceLabel>
          </div>
        ) : (
          <SalePrice
            list={plan.priceVnd}
            sale={plan.promoPriceVnd}
            percent={plan.promoPercent}
            label={plan.promoLabel}
            currency={currency}
            stacked
          />
        )}
        <PlanPriceMeta>{platformPriceMetaText(plan)}</PlanPriceMeta>
        {currency.showReferenceUsd && !isEnterprise && !isFree ? (
          <p className="mt-0.5 text-[10px] leading-4 text-slate-400">
            {formatReferenceUsd(
              plan.promoPriceVnd && plan.promoPercent ? plan.promoPriceVnd : plan.priceVnd,
              currency,
            )}
          </p>
        ) : null}
      </div>

      {/* 4 Core Quota Stats */}
      <PlanStatGrid ariaLabel="Thông số chính" items={platformHighlightStats(plan)} />

      {/* CTA Button */}
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
                ? 'Nâng cấp ngay'
                : 'Chọn gói này'}
          <ArrowRight className="home-solution-arrow h-3.5 w-3.5" />
        </Link>
      )}

      {/* Feature Checklist */}
      <div className="mt-5 flex-1 border-t border-slate-100 pt-4">
        <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Quyền lợi trong gói
        </p>
        <ul className="space-y-2">
          {rows.map((row, idx) => (
            <li
              key={`${idx}-${row.label}`}
              aria-disabled={row.included ? undefined : true}
              className="flex items-start gap-2"
            >
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                {row.included ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.6} />
                ) : (
                  <X className="h-3.5 w-3.5 text-slate-300" strokeWidth={2.4} />
                )}
              </span>
              <span
                title={row.label}
                className={clsx(
                  'min-w-0 text-xs leading-5',
                  row.included ? 'font-medium text-slate-700' : 'text-slate-400',
                )}
              >
                <span className="sr-only">{row.included ? 'Bao gồm: ' : 'Không bao gồm: '}</span>
                {row.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Thẻ ngang cao cấp dành riêng cho gói ENTERPRISE (Hàng 2 của bố cục 4 + 1) */
function EnterprisePlanBanner({
  domId,
  highlighted = false,
  plan,
  enterpriseCtaHref,
  canRequestEnterprise,
}: {
  domId?: string;
  highlighted?: boolean;
  plan: BillingPlatformPlanView;
  currency: BillingCurrencyDisplay;
  isRecruiter: boolean;
  checkoutReady: boolean;
  planCtaHref: (code: string) => string;
  freeCtaHref: () => string;
  enterpriseCtaHref: () => string;
  canRequestEnterprise: boolean;
}) {
  const stats = platformHighlightStats(plan);
  const includedRows = displayFeatureLines(plan).filter((r) => r.included);

  return (
    <div
      id={domId}
      className={clsx(
        'relative scroll-mt-40 overflow-hidden rounded-3xl border bg-gradient-to-r from-[#072348] via-[#0a2f5e] to-[#0d3b80] p-6 text-white shadow-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl sm:p-8',
        highlighted ? 'border-amber-400 ring-4 ring-amber-400/50' : 'border-[#123d73] hover:border-amber-400/60',
      )}
    >
      <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-500/15 blur-3xl" aria-hidden="true" />
      <div className="relative grid items-center gap-6 lg:grid-cols-12 lg:gap-8">
        {/* Col 1: Identity & Custom Quote */}
        <div className="lg:col-span-4">
          <span className="home-step-badge inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
            <Building2 className="h-3 w-3" /> Giải pháp Tập đoàn & Nhà máy lớn
          </span>
          <div className="mt-3 flex items-baseline gap-3">
            <h3 className="text-2xl font-extrabold uppercase tracking-tight text-white sm:text-3xl">
              {plan.name}
            </h3>
            <span className="rounded-lg bg-white/10 px-2.5 py-1 text-sm font-bold text-amber-300">
              Báo giá riêng
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-300 sm:text-sm">
            {pricingPlatformFact(plan).description}
          </p>
          <p className="mt-1.5 text-[11px] font-medium text-amber-200/90">
            {platformPriceMetaText(plan)} · Hợp đồng SLA & xuất hoá đơn VAT theo kỳ
          </p>
        </div>

        {/* Col 2: Stats & Key Enterprise Perks */}
        <div className="lg:col-span-5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" aria-label="Thông số gói Enterprise">
            {stats.map((stat) => (
              <div
                key={stat.label}
                title={stat.hint}
                className="flex flex-col items-center justify-center rounded-xl border border-amber-400/25 bg-gradient-to-b from-white/[0.11] to-white/[0.04] px-2.5 py-2.5 text-center shadow-inner transition-colors hover:border-amber-400/55 hover:bg-white/[0.13]"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">{stat.label}</p>
                <p className="mt-1 text-lg font-extrabold leading-none tabular-nums text-amber-300 sm:text-xl">
                  {stat.value}
                </p>
                {stat.sub ? (
                  <p className="mt-1 text-[10px] font-medium leading-tight text-amber-100/80">{stat.sub}</p>
                ) : null}
              </div>
            ))}
          </div>
          <ul className="mt-4 grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {includedRows.slice(0, 6).map((row, idx) => (
              <li key={`${idx}-${row.label}`} className="flex items-start gap-2 text-xs leading-snug text-slate-200">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" strokeWidth={2.6} />
                <span className="min-w-0">
                  <span className="sr-only">Bao gồm: </span>
                  {row.label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Col 3: Action CTA */}
        <div className="flex flex-col items-stretch justify-center lg:col-span-3">
          {canRequestEnterprise ? (
            <EnterpriseConsultButton
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 text-sm font-bold text-[#072348] shadow-lg shadow-amber-500/25 transition hover:-translate-y-0.5 hover:bg-amber-400 disabled:opacity-60"
              label="Yêu cầu tư vấn Enterprise"
              noteClassName="mt-2 text-center text-xs text-emerald-300"
              errorClassName="mt-2 text-center text-xs text-rose-300"
            />
          ) : (
            <Link
              href={enterpriseCtaHref()}
              className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 text-sm font-bold text-[#072348] shadow-lg shadow-amber-500/25 transition hover:-translate-y-0.5 hover:bg-amber-400"
            >
              Liên hệ tư vấn báo giá <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          )}
          <p className="mt-2 text-center text-[11px] text-slate-300">
            Thiết kế hạn mức JD, Credit & phân quyền nhiều chi nhánh theo nhu cầu thực tế.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SOURCING PLANS
// ============================================================================
function buildSourcingPromoSummary(plans: BillingSourcingPlanView[]): string | null {
  const promoPlans = plans.filter((p) => p.promoPercent && p.promoPercent > 0);
  if (promoPlans.length === 0) return null;
  const maxPct = Math.max(...promoPlans.map((p) => p.promoPercent ?? 0));
  return `Giảm ${maxPct}% phí dịch vụ cho các gói Săn nhân sự theo vị trí`;
}

function SourcingPlansView({
  plans,
  currency,
  vatPercent,
  highlightedId,
  onPlatform,
  onTopup,
  planCtaHref,
  page,
}: {
  plans: BillingSourcingPlanView[];
  currency: BillingCurrencyDisplay;
  vatPercent: number | null;
  highlightedId?: string | null;
  onPlatform: () => void;
  onTopup: () => void;
  planCtaHref: (code: string) => string;
  page: BillingPageContentView;
}) {
  const activePlans = plans.filter((p) => p.isActive);
  const promoNote = buildSourcingPromoSummary(activePlans);

  return (
    <section id="tinsan" aria-labelledby="sourcing" className="scroll-mt-36">
      <div className="home-reasons-head mb-8 text-center">
        <PricingH2 id="sourcing" className="text-2xl font-bold text-[#072348] sm:text-3xl scroll-mt-36">
          {page.sourcingTitle}
        </PricingH2>
        <p className="mt-1.5 text-sm text-slate-500">{page.sourcingSubtitle}</p>
        <span className="home-reasons-mark mx-auto mt-3.5 block h-1 w-14 rounded-full bg-[#F08A24]" />
        <p className="mx-auto mt-3 max-w-3xl text-xs leading-relaxed text-slate-600 sm:text-sm">
          Đội ngũ chuyên gia {PRICING_BRAND} trực tiếp tìm kiếm, sàng lọc và bàn giao ứng viên theo tiêu chí kỹ thuật của nhà máy. Giá gói đã bao gồm quyền đăng tin và sử dụng nền tảng cho vị trí đó.
        </p>
        <PromoRibbon promoNote={promoNote} vatPercent={vatPercent} showCountdown={Boolean(promoNote)} />
      </div>

      <div className="grid items-stretch gap-5 pt-3 md:grid-cols-2 lg:grid-cols-3">
        {activePlans.map((p, idx) => {
          const domId = planDomId(p.code);
          return (
            <SourcingPlanCard
              key={p.id}
              domId={domId}
              index={idx}
              highlighted={highlightedId === domId}
              plan={p}
              currency={currency}
              planCtaHref={planCtaHref}
            />
          );
        })}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <CrossSellCard
          title="Muốn tự đăng tin & chủ động lọc hồ sơ trên nền tảng?"
          desc="Khám phá các Gói Nền Tảng từ Miễn phí đến Doanh nghiệp với công nghệ AI Matching tự động."
          cta="Xem Gói Nền Tảng"
          onClick={onPlatform}
        />
        <CrossSellCard
          title="Cần nạp thêm Credit để mở hồ sơ ứng viên tiềm năng?"
          desc="Mua thêm Credit bất kỳ lúc nào — đơn giá tiết kiệm theo số lượng, không giới hạn thời hạn sử dụng."
          cta="Xem Top-up Credit"
          onClick={onTopup}
        />
      </div>
    </section>
  );
}

function SourcingPlanCard({
  domId,
  highlighted = false,
  plan,
  currency,
  planCtaHref,
}: {
  domId?: string;
  index?: number;
  highlighted?: boolean;
  plan: BillingSourcingPlanView;
  currency: BillingCurrencyDisplay;
  planCtaHref: (code: string) => string;
}) {
  const featured = plan.isFeatured;
  return (
    <div
      id={domId}
      className={clsx(
        'home-solution-card relative flex min-w-0 scroll-mt-40 flex-col rounded-2xl border bg-white p-6 transition-all',
        highlighted
          ? 'z-10 border-amber-500 ring-4 ring-amber-400/50 shadow-[0_24px_48px_-16px_rgba(232,135,42,0.55)]'
          : featured
            ? 'z-10 border-amber-400 ring-2 ring-amber-400/30 shadow-[0_20px_40px_-20px_rgba(232,135,42,0.45)]'
            : 'border-slate-200 shadow-[0_8px_24px_-16px_rgba(7,35,72,0.18)] hover:border-slate-300',
      )}
    >
      {featured ? (
        <span className="home-step-badge absolute -top-3.5 left-6 inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#072348] shadow-sm">
          <Star className="h-3 w-3 fill-[#072348]" /> Đề xuất tối ưu
        </span>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold uppercase tracking-tight text-[#072348]">{plan.name}</h3>
          {plan.description ? (
            <p className="mt-1 line-clamp-2 min-h-[2.25rem] text-xs leading-relaxed text-slate-500">
              {normalizePricingBrand(plan.description)}
            </p>
          ) : null}
        </div>
        <div
          className={clsx(
            'home-reasons-glyph flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            featured ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-[#072348]',
          )}
        >
          <Shield className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 flex min-h-[5.75rem] flex-col justify-end rounded-xl bg-slate-50/80 px-3.5 py-3">
        <SalePrice
          list={plan.feeVnd}
          sale={plan.promoPriceVnd}
          percent={plan.promoPercent}
          label={plan.promoLabel}
          currency={currency}
          stacked
        />
        <p className="mt-1.5 text-xs font-medium text-slate-500">Phí dịch vụ / vị trí · Triển khai 30 ngày</p>
        {currency.showReferenceUsd ? (
          <p className="mt-0.5 text-[10px] text-slate-400">
            {formatReferenceUsd(plan.promoPriceVnd && plan.promoPercent ? plan.promoPriceVnd : plan.feeVnd, currency)}
          </p>
        ) : null}
      </div>

      <PlanStatGrid
        ariaLabel="Thông số gói săn"
        items={[
          { label: 'Vị trí', value: plan.positionQuota == null ? '∞' : String(plan.positionQuota) },
          {
            label: 'Credit',
            value: plan.creditQuota == null ? '∞' : String(plan.creditQuota),
            hint: '< 80% Matching: 1 Credit · ≥ 80% Matching: 2 Credit',
          },
          { label: 'Điều chỉnh', value: plan.revisionQuota == null ? '∞' : String(plan.revisionQuota) },
          { label: 'Báo cáo', value: plan.searchRoundQuota == null ? '∞' : String(plan.searchRoundQuota) },
        ]}
      />

      <Link
        href={planCtaHref(plan.code)}
        className={clsx(
          'mt-4 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-bold transition',
          featured
            ? 'bg-amber-500 text-[#072348] shadow-md shadow-amber-500/20 hover:bg-amber-400'
            : 'bg-[#072348] text-white shadow-sm hover:bg-[#0d3b80]',
        )}
      >
        {planCtaHref(plan.code).startsWith('/recruiter') ? 'Đăng ký gói Săn' : 'Chọn gói Săn này'}{' '}
        <ArrowRight className="home-solution-arrow h-3.5 w-3.5" />
      </Link>

      {/* Service scope */}
      <div className="mt-5 flex-1 border-t border-slate-100 pt-4">
        <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Phạm vi công việc {PRICING_BRAND} thực hiện
        </p>
        <ul className="space-y-2">
          {scopeLinesOf(plan).map((line) => (
            <li
              key={line.code}
              aria-disabled={line.included ? undefined : true}
              className={clsx(
                'flex items-start gap-2 text-xs leading-5',
                line.included ? 'font-medium text-slate-700' : 'text-slate-400',
              )}
            >
              {line.included ? (
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={2.6} aria-hidden="true" />
              ) : (
                <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" strokeWidth={2.4} aria-hidden="true" />
              )}
              <span>
                <span className="sr-only">{line.included ? 'Bao gồm: ' : 'Không bao gồm: '}</span>
                {line.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PlanStatGrid({
  items,
  ariaLabel,
}: {
  items: { label: string; value: string; hint?: string }[];
  ariaLabel: string;
}) {
  return (
    <div className="mt-3.5 grid grid-cols-4 gap-1.5" aria-label={ariaLabel}>
      {items.map((stat) => (
        <div
          key={stat.label}
          title={stat.hint}
          className="rounded-xl border border-slate-200/70 bg-white px-1.5 py-2 text-center shadow-[0_1px_2px_rgba(7,35,72,0.03)]"
        >
          <p className="truncate text-[10px] font-medium leading-4 text-slate-500">{stat.label}</p>
          <p className="mt-0.5 text-sm font-extrabold tabular-nums leading-none text-[#072348] sm:text-base">
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// CREDIT TOP-UP
// ============================================================================
function CreditTopupView({
  topups,
  currency,
  vatPercent,
  onPlatform,
  onSourcing,
  topupCtaHref,
  page,
}: {
  topups: BillingCreditTopupView[];
  currency: BillingCurrencyDisplay;
  vatPercent: number | null;
  onPlatform: () => void;
  onSourcing: () => void;
  topupCtaHref: (id: string) => string;
  page: BillingPageContentView;
}) {
  const activeTopups = topups.filter((t) => t.isActive);
  const maxUnitPrice = activeTopups.length
    ? Math.max(...activeTopups.map((t) => Number(BigInt(t.unitPriceVnd))))
    : 0;

  return (
    <section aria-labelledby="credit" className="scroll-mt-36">
      <div className="home-reasons-head mb-8 text-center">
        <PricingH2 id="credit" className="text-2xl font-bold text-[#072348] sm:text-3xl scroll-mt-36">
          {page.creditTitle}
        </PricingH2>
        <p className="mt-2 text-sm text-slate-500">{page.creditSubtitle}</p>
        <span className="home-reasons-mark mx-auto mt-3.5 block h-1 w-14 rounded-full bg-[#F08A24]" />
        <PromoRibbon
          promoNote="Credit mua thêm có thời hạn vĩnh viễn và được bảo lưu ngay cả khi gói đăng tin hết hạn."
          vatPercent={vatPercent}
        />
      </div>

      <div className="grid items-stretch gap-5 pt-3 md:grid-cols-2 lg:grid-cols-3">
        {activeTopups.map((t, idx) => (
          <CreditTopupCard
            key={t.id}
            index={idx}
            topup={t}
            maxUnitPrice={maxUnitPrice}
            currency={currency}
            topupCtaHref={topupCtaHref}
          />
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-slate-500">
        <CreditCard className="mr-1.5 inline h-4 w-4 text-[#072348]" />
        Hỗ trợ thanh toán chuyển khoản ngân hàng / QR doanh nghiệp và xuất hoá đơn GTGT đầy đủ.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <CrossSellCard
          title="Chưa có gói đăng tin nền tảng?"
          desc="Các gói Tin đăng, Tin đăng Plus và Doanh nghiệp đều đã tặng sẵn từ 15 đến 50 Credit mở hồ sơ."
          cta="Xem Gói Nền Tảng"
          onClick={onPlatform}
        />
        <CrossSellCard
          title={`Muốn uỷ thác toàn bộ việc săn hồ sơ cho ${PRICING_BRAND}?`}
          desc="Chuyên gia tuyển dụng công nghiệp của chúng tôi sẽ tìm kiếm và sàng lọc ứng viên thay bạn."
          cta="Xem Gói Săn Nhân Sự"
          onClick={onSourcing}
        />
      </div>
    </section>
  );
}

function CreditTopupCard({
  topup,
  maxUnitPrice,
  currency,
  topupCtaHref,
}: {
  index?: number;
  topup: BillingCreditTopupView;
  maxUnitPrice: number;
  currency: BillingCurrencyDisplay;
  topupCtaHref: (id: string) => string;
}) {
  const featured = topup.isFeatured;
  const unitPrice = Number(BigInt(topup.unitPriceVnd));
  const savingPct =
    maxUnitPrice > 0 && unitPrice < maxUnitPrice
      ? Math.round(((maxUnitPrice - unitPrice) / maxUnitPrice) * 100)
      : 0;

  return (
    <div
      className={clsx(
        'home-solution-card relative flex min-w-0 flex-col rounded-2xl border bg-white p-6 transition-all',
        featured
          ? 'z-10 border-amber-400 ring-2 ring-amber-400/30 shadow-[0_20px_40px_-20px_rgba(232,135,42,0.45)]'
          : 'border-slate-200 shadow-[0_8px_24px_-16px_rgba(7,35,72,0.18)] hover:border-slate-300',
      )}
    >
      {topup.badge || featured ? (
        <span className="home-step-badge absolute -top-3.5 left-6 inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#072348] shadow-sm">
          <Star className="h-3 w-3 fill-[#072348]" />
          {topup.badge ?? 'Được chọn nhiều'}
        </span>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold uppercase tracking-tight text-[#072348]">{topup.name}</h3>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Cộng ngay <strong className="text-[#072348]">{topup.creditCount} Credit</strong> vào ví doanh nghiệp
          </p>
        </div>
        <span
          className={clsx(
            'home-reasons-glyph flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            featured ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-[#072348]',
          )}
        >
          <Coins className="h-5 w-5" />
        </span>
      </div>

      <div className="mt-4 rounded-xl bg-slate-50/80 px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <PlanPrice value={topup.priceVnd} currency={currency} />
          {savingPct > 0 ? (
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
              Tiết kiệm {savingPct}%
            </span>
          ) : null}
        </div>
        {currency.showReferenceUsd ? (
          <p className="mt-0.5 text-[10px] text-slate-400">{formatReferenceUsd(topup.priceVnd, currency)}</p>
        ) : null}
        <p className="mt-1.5 text-xs text-slate-600">
          Đơn giá tương đương:{' '}
          <strong className="text-[#072348]">
            {formatPriceVnd(topup.unitPriceVnd, { ...currency, decimalDigits: 0 })}
          </strong>{' '}
          / Credit
        </p>
      </div>

      <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600">
        <li className="flex items-center gap-2">
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={2.6} />
          <span>Hiệu lực sử dụng <strong>vô thời hạn</strong>, bảo lưu qua các kỳ</span>
        </li>
        <li className="flex items-center gap-2">
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={2.6} />
          <span>Mở hồ sơ &lt; 80% Matching: 1 Credit · ≥ 80% Matching: 2 Credit</span>
        </li>
        <li className="flex items-center gap-2">
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={2.6} />
          <span>Mở lại hồ sơ đã mở hoặc xem CV tự ứng tuyển: <strong>0 Credit</strong></span>
        </li>
      </ul>

      <Link
        href={topupCtaHref(topup.id)}
        className={clsx(
          'mt-5 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-bold transition',
          featured
            ? 'bg-amber-500 text-[#072348] shadow-md shadow-amber-500/20 hover:bg-amber-400'
            : 'bg-[#072348] text-white shadow-sm hover:bg-[#0d3b80]',
        )}
      >
        Mua gói Credit này <ArrowRight className="home-solution-arrow h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

// ============================================================================
// HOW IT WORKS & PLATFORM FEATURES (ANIMATED LIKE HOME-STEPS & HOME-REASONS)
// ============================================================================
function HowItWorksSection({ page }: { page: BillingPageContentView }) {
  return (
    <section
      id="how"
      aria-labelledby="how-title"
      className="relative overflow-hidden bg-gradient-to-br from-[#072348] via-[#0b2f5c] to-[#0d3b80] py-14 text-white sm:py-20 scroll-mt-20"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        aria-hidden="true"
      />
      <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-amber-500/15 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="home-reasons-head mb-10 text-center">
          <PricingH2 id="how-title" className="text-2xl font-bold sm:text-3xl">
            {page.howTitle}
          </PricingH2>
          <p className="mt-2 text-sm text-slate-300">{page.howSubtitle}</p>
          <span className="home-reasons-mark mx-auto mt-3.5 block h-1 w-14 rounded-full bg-[#F08A24]" />
        </div>

        <dl className="grid gap-6 lg:grid-cols-3">
          {page.howSteps.map((step, i) => (
            <div
              key={`${step.title}-${i}`}
              style={{ animationDelay: `${i * 120}ms` }}
              className="home-reasons-item relative flex"
            >
              <div
                style={{ animationDelay: `${i * 0.8}s` }}
                className="home-hero-float-card group flex w-full flex-col rounded-2xl border border-white/15 bg-white/[0.07] p-6 backdrop-blur-sm transition-colors hover:border-amber-400/50 hover:bg-white/[0.11]"
              >
                <div className="flex items-center justify-between">
                  <span
                    style={{ animationDelay: `${i * 0.6}s` }}
                    className="home-step-badge inline-flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/20 text-lg font-extrabold text-amber-300 ring-1 ring-inset ring-amber-400/30"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {i < page.howSteps.length - 1 && (
                    <ArrowRight
                      style={{ animationDelay: `${i * 0.35}s` }}
                      className="home-step-arrow hidden h-5 w-5 text-amber-300/80 lg:block"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <dt className="mt-4 text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                  {step.title}
                </dt>
                <dd className="mt-2 text-sm leading-relaxed text-slate-300">{step.desc}</dd>
              </div>
            </div>
          ))}
        </dl>

        <p className="home-reasons-item mx-auto mt-8 max-w-2xl rounded-xl border border-amber-400/30 bg-white/[0.06] px-4 py-3 text-center text-xs font-medium text-amber-200 backdrop-blur-sm sm:text-sm">
          {page.howFooter}
        </p>
      </div>
    </section>
  );
}

function FeaturesSection({ page }: { page: BillingPageContentView }) {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className="relative overflow-hidden bg-[radial-gradient(900px_420px_at_8%_-8%,rgba(240,138,36,0.09),transparent_62%),radial-gradient(880px_420px_at_94%_108%,rgba(12,47,87,0.08),transparent_65%),#f8fafc] py-14 sm:py-20 scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="home-reasons-head mb-10 text-center">
          <PricingH2 id="features-title" className="text-2xl font-bold text-[#072348] sm:text-3xl">
            {page.featuresTitle}
          </PricingH2>
          <p className="mt-2 text-sm text-slate-500">{page.featuresSubtitle}</p>
          <span className="home-reasons-mark mx-auto mt-3.5 block h-1 w-14 rounded-full bg-[#F08A24]" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {page.features.map((f, i) => {
            const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length] ?? Sparkles;
            return (
              <div
                key={`${f.title}-${i}`}
                style={{ animationDelay: `${i * 90}ms` }}
                className="home-reasons-item home-solution-card group rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition-all"
              >
                <div
                  style={{ animationDelay: `${(i % 3) * 0.45}s` }}
                  className="home-reasons-glyph mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 transition-colors group-hover:bg-amber-500 group-hover:text-[#072348]"
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-[#072348] transition-colors group-hover:text-[#0d3b80]">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// FAQ (2-COLUMN EXECUTIVE B2B LAYOUT)
// ============================================================================
function FAQSection({ page, vatPercent = null }: { page: BillingPageContentView; vatPercent?: number | null }) {
  return (
    <section id="faq" aria-labelledby="faq-title" className="border-t border-slate-200/80 bg-white py-14 sm:py-20 scroll-mt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="home-reasons-head mb-10 text-center">
          <PricingH2 id="faq-title" className="text-2xl font-bold text-[#072348] sm:text-3xl">
            {page.faqTitle}
          </PricingH2>
          <p className="mt-2 text-sm text-slate-500">{page.faqSubtitle}</p>
          <span className="home-reasons-mark mx-auto mt-3.5 block h-1 w-14 rounded-full bg-[#F08A24]" />
        </div>
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {page.faqItems.map((item, i) => (
            <details
              key={i}
              style={{ animationDelay: `${i * 70}ms` }}
              className="home-reasons-item group overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-50/50 transition-all hover:border-amber-300/80 hover:bg-white open:border-amber-400/80 open:bg-white open:shadow-md"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-left text-sm font-bold text-[#072348] [&::-webkit-details-marker]:hidden">
                <span>{item.q}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180 group-open:text-amber-600" />
              </summary>
              <div className="border-t border-slate-100 px-5 py-4 text-sm leading-relaxed text-slate-600">
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
// UNIFIED BOTTOM CTA (COMBINES SALES CONSULT + FINAL START CTA)
// ============================================================================
function UnifiedBottomCTA({
  page,
  checkoutReady,
}: {
  page: BillingPageContentView;
  checkoutReady: boolean;
}) {
  const channels = [
    {
      icon: Mail,
      label: 'Email bộ phận B2B',
      value: page.contactEmail,
      href: `mailto:${page.contactEmail}`,
      desc: page.contactEmailDesc,
    },
    {
      icon: Phone,
      label: 'Hotline tư vấn trực tiếp',
      value: page.contactHotline,
      href: page.contactHotlineHref,
      desc: page.contactHotlineDesc,
    },
    {
      icon: MessageCircle,
      label: 'Zalo Official Account',
      value: page.contactZaloLabel,
      href: page.contactZaloHref,
      desc: page.contactZaloDesc,
    },
  ];

  return (
    <section
      id="contact"
      aria-labelledby="contact-title"
      className="bg-slate-50 py-14 sm:py-20 scroll-mt-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="home-reasons-item relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#072348] via-[#0a2d5e] to-[#0d3b80] p-8 text-white shadow-xl sm:p-12">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-500/15 blur-3xl" aria-hidden="true" />
          <div className="relative grid items-center gap-8 lg:grid-cols-12">
            {/* Left column: Value prop + Direct start CTA */}
            <div className="home-reasons-head lg:col-span-5">
              <span className="home-step-badge inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-200">
                Đồng hành cùng doanh nghiệp công nghiệp
              </span>
              <PricingH2 id="contact-title" className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl">
                {page.contactTitle}
              </PricingH2>
              <span className="home-reasons-mark mt-3 block h-1 w-14 rounded-full bg-[#F08A24]" />
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                {page.contactSubtitle}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {page.finalCtaTitle} — {page.finalCtaSubtitle}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href={checkoutReady ? '/recruiter/billing' : '/register'}
                  className="group inline-flex h-11 items-center gap-2 rounded-xl bg-amber-500 px-6 text-sm font-bold text-[#072348] shadow-lg shadow-amber-500/25 transition-all hover:-translate-y-0.5 hover:bg-amber-400"
                >
                  {checkoutReady ? 'Quản lý gói của tôi' : 'Đăng ký miễn phí ngay'}{' '}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* Right column: 3 Direct B2B Contact Channels */}
            <div className="grid gap-3.5 sm:grid-cols-3 lg:col-span-7">
              {channels.map((ch, idx) => (
                <a
                  key={ch.label}
                  href={ch.href}
                  style={{ animationDelay: `${idx * 0.7}s` }}
                  className="home-hero-float-card group flex flex-col justify-between rounded-2xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur-sm transition-all hover:border-amber-300/60 hover:bg-white/10"
                >
                  <div>
                    <div className="home-reasons-glyph mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300">
                      <ch.icon className="h-5 w-5" />
                    </div>
                    <p className="text-xs font-medium text-slate-300">{ch.label}</p>
                    <p className="mt-1 break-all text-sm font-extrabold text-white group-hover:text-amber-300">
                      {ch.value}
                    </p>
                  </div>
                  <p className="mt-3 border-t border-white/10 pt-2 text-[11px] text-slate-400">{ch.desc}</p>
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
// MOBILE BOTTOM BAR & ZALO FAB
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
      className="home-solution-card group flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 text-left shadow-sm transition-all"
    >
      <div className="min-w-0">
        <p className="text-sm font-bold text-[#072348] transition-colors group-hover:text-amber-700">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{desc}</p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-amber-50 px-3.5 py-2 text-xs font-bold text-[#072348] ring-1 ring-inset ring-amber-300/80 transition-colors group-hover:bg-amber-500">
        {cta} <ArrowRight className="home-solution-arrow h-3.5 w-3.5" />
      </span>
    </button>
  );
}

// ============================================================================
// SKELETON & HELPERS
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
      <div className="mx-auto mt-12 grid max-w-6xl gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
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

function computeStats(config: BillingPublicConfig) {
  const activePlatform = config.platformPlans.filter((p) => p.isActive);
  const activeSourcing = config.sourcingPlans.filter((p) => p.isActive);
  const activeTopups = config.creditTopups.filter((p) => p.isActive);

  const cheapestTopup = [...activeTopups].sort((a, b) =>
    Number(BigInt(a.priceVnd) - BigInt(b.priceVnd)),
  )[0];
  const unitPrices = activeTopups.map((t) => Number(BigInt(t.unitPriceVnd)));
  const maxUnit = unitPrices.length ? Math.max(...unitPrices) : 0;
  const minUnit = unitPrices.length ? Math.min(...unitPrices) : 0;
  const savingPct =
    maxUnit > 0 && minUnit < maxUnit ? Math.round(((maxUnit - minUnit) / maxUnit) * 100) : undefined;

  const platformPromos = activePlatform.map((p) => p.promoPercent ?? 0).filter((n) => n > 0);
  const sourcingPromos = activeSourcing.map((p) => p.promoPercent ?? 0).filter((n) => n > 0);

  return {
    planCount: activePlatform.length,
    sourcingCount: activeSourcing.length,
    topupCount: activeTopups.length,
    cheapestTopup,
    savingPct,
    maxPlatformPromo: platformPromos.length ? Math.max(...platformPromos) : undefined,
    maxSourcingPromo: sourcingPromos.length ? Math.max(...sourcingPromos) : undefined,
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

  // Tab & Deep-link Hash state
  const [tab, setTab] = useState<PricingTab>('platform');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const skipTabScroll = useRef(true);

  const switchTab = (next: PricingTab) => {
    setTab(next);
    setHighlightedId(null);
    if (!embedded && typeof window !== 'undefined') {
      const hash = next === 'platform' ? '#nentang' : next === 'sourcing' ? '#tinsan' : '#credit';
      window.history.replaceState(null, '', hash);
    }
  };

  useEffect(() => {
    if (embedded || !resolved || typeof window === 'undefined') return;
    const applyHash = () => {
      const matched = resolvePricingHash(window.location.hash);
      if (!matched) return;
      skipTabScroll.current = true;
      setTab(matched.tab);
      if (matched.highlightId) {
        setHighlightedId(matched.highlightId);
      }
      window.setTimeout(() => {
        const el =
          document.getElementById(matched.targetId) ??
          document.getElementById(
            matched.tab === 'platform' ? 'nentang' : matched.tab === 'sourcing' ? 'tinsan' : 'credit',
          );
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    };

    applyHash();
    window.addEventListener('hashchange', applyHash);
    return () => window.removeEventListener('hashchange', applyHash);
  }, [embedded, resolved]);

  useEffect(() => {
    if (!highlightedId) return;
    const timer = window.setTimeout(() => setHighlightedId(null), 4000);
    return () => window.clearTimeout(timer);
  }, [highlightedId]);

  useEffect(() => {
    if (embedded) return;
    if (skipTabScroll.current) {
      skipTabScroll.current = false;
      return;
    }
    const id = tab === 'platform' ? 'nentang' : tab === 'sourcing' ? 'tinsan' : 'credit';
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [tab, embedded]);

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
          embedded
          tab={tab}
          onTabChange={switchTab}
          page={page}
          stats={stats}
        />
        <section>
          <PricingTabPane active={tab === 'platform'}>
            <PlatformPlansView
              plans={resolved.platformPlans}
              currency={cur}
              vatPercent={vatPercent}
              highlightedId={highlightedId}
              onSourcing={() => switchTab('sourcing')}
              onTopup={() => switchTab('credit')}
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
              vatPercent={vatPercent}
              highlightedId={highlightedId}
              onPlatform={() => switchTab('platform')}
              onTopup={() => switchTab('credit')}
              planCtaHref={sourcingCtaHref}
              page={page}
            />
          </PricingTabPane>
          <PricingTabPane active={tab === 'credit'}>
            <CreditTopupView
              topups={resolved.creditTopups}
              currency={cur}
              vatPercent={vatPercent}
              onPlatform={() => switchTab('platform')}
              onSourcing={() => switchTab('sourcing')}
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
          flush
        />
      </div>
    );
  }

  return (
    <>
      {/* 1. HEADER & HERO (with integrated Trust Commitments) */}
      {!isRecruiter && <TopNav checkoutReady={checkoutReady} />}
      {isRecruiter ? (
        <HeroRecruiter page={page} />
      ) : (
        <HeroPublic stats={stats} page={page} checkoutReady={checkoutReady} onSelectTab={switchTab} />
      )}

      {/* 2. STICKY 3-TIER SERVICE SWITCHER & MAIN PRICING */}
      <SectionNav tab={tab} onTabChange={switchTab} page={page} stats={stats} />

      <section className="relative isolate bg-slate-50 py-8 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <PricingTabPane active={tab === 'platform'}>
            <PlatformPlansView
              plans={resolved.platformPlans}
              currency={cur}
              vatPercent={vatPercent}
              highlightedId={highlightedId}
              onSourcing={() => switchTab('sourcing')}
              onTopup={() => switchTab('credit')}
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
              vatPercent={vatPercent}
              highlightedId={highlightedId}
              onPlatform={() => switchTab('platform')}
              onTopup={() => switchTab('credit')}
              planCtaHref={sourcingCtaHref}
              page={page}
            />
          </PricingTabPane>
          <PricingTabPane active={tab === 'credit'}>
            <CreditTopupView
              topups={resolved.creditTopups}
              currency={cur}
              vatPercent={vatPercent}
              onPlatform={() => switchTab('platform')}
              onSourcing={() => switchTab('sourcing')}
              topupCtaHref={topupCtaHref}
              page={page}
            />
          </PricingTabPane>
        </div>
      </section>

      {/* 3. DETAILED COMPARISON MATRIX */}
      <CompareSection
        platformPlans={resolved.platformPlans}
        sourcingPlans={resolved.sourcingPlans}
        topups={resolved.creditTopups}
        currency={cur}
        page={page}
      />

      {/* 4. TRANSPARENT BILLING MECHANISM & CORE FEATURES */}
      {!isRecruiter && <HowItWorksSection page={page} />}
      {!isRecruiter && <FeaturesSection page={page} />}

      {/* 5. 2-COLUMN FAQ */}
      {!isRecruiter && <FAQSection page={page} vatPercent={vatPercent} />}

      {/* 6. UNIFIED B2B CONSULT & START CTA + SYSTEM FOOTER */}
      <UnifiedBottomCTA page={page} checkoutReady={checkoutReady} />
      {!isRecruiter && <SiteFooter />}

      {/* FLOATING ZALO FAB & MOBILE BOTTOM BAR */}
      {!isRecruiter && <ZaloFAB page={page} />}
      {!isRecruiter && <MobileBottomBar page={page} />}
      {!isRecruiter && <div className="h-16 lg:hidden" aria-hidden="true" />}
    </>
  );
}
