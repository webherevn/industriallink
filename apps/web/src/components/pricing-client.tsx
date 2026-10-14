'use client';

import { useState } from 'react';
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
  Grip,
  Mail,
  Menu,
  MessageCircle,
  Package,
  Phone,
  Play,
  Plus,
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
  SourcingServiceScope,
} from '@industriallink/contracts';
import { formatPriceVnd, formatReferenceUsd } from '@/lib/format-billing';
import { BrandMark } from './brand-logo';

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

// TODO: cập nhật số thực tế khi có data
const COMPANY_COUNT = '50+';

const FAQ = [
  {
    q: 'Giá đã bao gồm VAT chưa?',
    a: 'Giá hiển thị chưa bao gồm VAT 10%. Hoá đơn VAT được xuất theo yêu cầu khi thanh toán.',
  },
  {
    q: 'Tôi có thể đổi từ Tin đăng sang Tin đăng Plus không?',
    a: 'Có. Vào trang quản lý gói, chọn "Nâng cấp" và phần chênh lệch sẽ được tính theo tỉ lệ thời gian còn lại.',
  },
  {
    q: 'Credit mua thêm có hết hạn không?',
    a: 'Theo chính sách hiện tại, Credit không hết hạn khi tài khoản còn hoạt động. Chúng tôi sẽ thông báo trước 30 ngày nếu có thay đổi.',
  },
  {
    q: 'Phí Săn nhân sự có bao gồm Credit không?',
    a: 'Không. Phí Săn (Cơ bản/Tiêu chuẩn/Chuyên sâu) là phí dịch vụ iLink thực hiện. Credit mua riêng theo nhu cầu mở hồ sơ tiềm năng.',
  },
  {
    q: 'iLink có auto-charge Credit khi hết không?',
    a: 'Không. Theo nguyên tắc V1, hệ thống không tự động mua Credit. Bạn chủ động mua khi cần.',
  },
  {
    q: 'Có hỗ trợ thanh toán qua chuyển khoản ngân hàng không?',
    a: 'Có. Doanh nghiệp và Enterprise hỗ trợ chuyển khoản, xuất hoá đơn VAT. Liên hệ sales@inlink.vn để được hỗ trợ.',
  },
];

// ============================================================================
// TOP NAV (PUBLIC)
// ============================================================================
function TopNav() {
  const [menuOpen, setMenuOpen] = useState(false);

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
          <Link
            href="/login"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Đăng nhập
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-[#072348] transition-colors hover:bg-amber-400"
          >
            Đăng ký miễn phí
          </Link>
        </div>

        {/* Mobile CTA + hamburger */}
        <div className="flex items-center gap-2 lg:hidden">
          <Link
            href="/register"
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-[#072348] transition-colors hover:bg-amber-400"
          >
            Đăng ký
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
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Đăng nhập
            </Link>
            <Link
              href="/register"
              onClick={() => setMenuOpen(false)}
              className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-bold text-[#072348] transition-colors hover:bg-amber-400"
            >
              Đăng ký miễn phí
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
function HeroPublic({ stats }: { stats: ReturnType<typeof computeStats> | null }) {
  const savingPct = stats?.savingPct ?? 20;

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
            <Sparkles className="h-3 w-3" /> Bảng giá 2026
          </span>

          {/* Headline */}
          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            <span className="block">Tuyển dụng công nghiệp</span>
            <span className="bg-gradient-to-r from-amber-300 to-amber-200 bg-clip-text text-transparent">
              minh bạch, không phát sinh
            </span>
          </h1>

          {/* Sub */}
          <p className="mt-5 text-base text-slate-300 sm:text-lg">
            iLink giúp nhà tuyển dụng đăng tin, matching AI, mở hồ sơ tiềm năng chỉ với vài cú
            click. Không auto-charge, không phí ẩn.
          </p>

          {/* CTA */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-500 px-6 text-sm font-bold text-[#072348] shadow-lg shadow-amber-500/30 transition-colors hover:bg-amber-400"
            >
              Bắt đầu miễn phí <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/15"
            >
              <Play className="h-4 w-4" /> Xem cách tính phí
            </a>
          </div>

          {/* Social proof */}
          <p className="mt-6 text-sm text-slate-400">
            Được {COMPANY_COUNT} doanh nghiệp FDI tin dùng
          </p>

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
function HeroRecruiter() {
  return (
    <section className="border-b border-slate-200 bg-white py-6 sm:py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-600">
          Tài khoản / Bảng giá
        </p>
        <h1 className="mt-1 text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl">
          Chọn gói phù hợp, nâng cấp bất kỳ lúc nào
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Tất cả gói dùng được ngay sau khi thanh toán. Hoá đơn VAT cho doanh nghiệp.
        </p>
      </div>
    </section>
  );
}

// ============================================================================
// SECTION NAV (STICKY TABS)
// ============================================================================
function SectionNav({ isRecruiter }: { isRecruiter: boolean }) {
  if (isRecruiter) return null;
  return (
    <nav
      className="sticky top-[57px] z-20 border-b border-slate-200 bg-white/90 backdrop-blur-md"
      aria-label="Chuyển tab bảng giá"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="flex rounded-xl bg-slate-100 p-1">
          {(
            [
              ['platform', 'Gói nền tảng', Package],
              ['sourcing', 'Săn nhân sự', Shield],
              ['credit', 'Top-up Credit', Coins],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                const el = document.getElementById(id === 'platform' ? 'pricing' : id);
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        <a
          href="#contact"
          className="hidden items-center gap-1 text-[12px] font-semibold text-slate-500 transition-colors hover:text-slate-900 sm:flex"
        >
          Cần tư vấn? Gọi 1900 6868
          {/* TODO: cập nhật số hotline thực tế */}
        </a>
      </div>
    </nav>
  );
}

// ============================================================================
// FEATURES SECTION
// ============================================================================
const FEATURES = [
  {
    icon: Sparkles,
    title: 'AI Matching thông minh',
    desc: 'Thuật toán AI phân tích JD, tìm ứng viên phù hợp. Matching chính xác, tiết kiệm 70% thời gian sàng lọc.',
  },
  {
    icon: FileText,
    title: 'Tạo JD từ template',
    desc: 'Template chuẩn công nghiệp, điền thông tin và nhận JD hoàn chỉnh chỉ trong 3 phút.',
  },
  {
    icon: UserCheck,
    title: 'Mở hồ sơ tiềm năng',
    desc: 'Dùng Credit để mở hồ sơ ứng viên tiềm năng. Không auto-charge, chủ động kiểm soát chi phí.',
  },
  {
    icon: Users,
    title: 'Nhiều user cùng dùng',
    desc: 'Gói Doanh nghiệp & Enterprise hỗ trợ nhiều tài khoản nhà tuyển dụng cùng lúc.',
  },
  {
    icon: BarChart3,
    title: 'Báo cáo hiệu quả',
    desc: 'Dashboard thống kê views, ứng tuyển, matching rate. Theo dõi ROI tuyển dụng dễ dàng.',
  },
  {
    icon: Coins,
    title: 'Top-up Credit linh hoạt',
    desc: 'Mua Credit theo nhu cầu thực tế. Đơn giá giảm khi mua nhiều. Không hết hạn khi tài khoản còn hoạt động.',
  },
];

function FeaturesSection() {
  return (
    <section id="features" className="bg-white py-14 sm:py-20 scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold text-[#072348] sm:text-3xl">Tính năng nổi bật</h2>
          <p className="mt-2 text-sm text-slate-500">
            Tất cả công cụ bạn cần để tuyển dụng công nghiệp hiệu quả.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-[#072348]">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// HOW IT WORKS
// ============================================================================
function HowItWorksSection() {
  const steps = [
    {
      num: '01',
      title: 'Chọn gói phù hợp',
      desc: 'Từ gói miễn phí Khám phá đến Enterprise — chọn gói phù hợp quy mô và nhu cầu tuyển dụng của bạn.',
    },
    {
      num: '02',
      title: 'Đăng JD & Matching AI',
      desc: 'Tạo JD bằng template hoặc paste nội dung. AI sẽ tự động phân tích và matching ứng viên phù hợp.',
    },
    {
      num: '03',
      title: 'Mua thêm Credit khi cần',
      desc: 'Mở hồ sơ ứng viên tiềm năng bằng Credit. Mua thêm bất kỳ lúc nào, đơn giá giảm theo số lượng.',
    },
  ];

  return (
    <section
      id="how"
      className="relative overflow-hidden bg-gradient-to-br from-[#072348] to-[#0d3b80] py-14 text-white sm:py-20 scroll-mt-20"
    >
      <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Chỉ trả cho những gì bạn dùng</h2>
          <p className="mt-2 text-sm text-slate-300">
            Quy trình đơn giản, không phí ẩn, không auto-charge.
          </p>
        </div>

        {/* Steps */}
        <div className="grid gap-6 lg:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.num} className="relative">
              {i < steps.length - 1 && (
                <div className="absolute -right-3 top-6 hidden text-slate-600 lg:block" aria-hidden="true">
                  <ArrowRight className="h-5 w-5" />
                </div>
              )}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                <span className="text-4xl font-bold text-amber-400">{step.num}</span>
                <h3 className="mt-3 text-base font-bold">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-slate-300">
          🎁 <strong>Tặng Credit khi mua gói</strong> — không auto-charge, không phí ẩn.
        </p>
      </div>
    </section>
  );
}

// ============================================================================
// COMPARE TABLE
// ============================================================================
const COMPARE_FEATURES = [
  { label: 'Số JD', keys: ['jobPostQuota', 'unlimited', 'unlimited', 'unlimited', 'unlimited'] },
  { label: 'Credit tặng kèm', keys: ['creditQuota', 0, 10, 30, 'Tùy gói', 'Tùy gói'] },
  { label: 'Mở hồ sơ ứng viên', keys: ['profileAccess', false, true, true, true, true] },
  { label: 'AI Matching', keys: ['aiMatch', false, true, true, true, true] },
  { label: 'Số user', keys: ['userCount', 1, 1, 3, 10, 'Không giới hạn'] },
  { label: 'Báo cáo', keys: ['reporting', false, true, true, true, true] },
  { label: 'Đăng tuyển đa nền tảng', keys: ['multiPost', false, false, true, true, true] },
  { label: 'Dịch vụ Săn nhân sự', keys: ['sourcing', false, false, false, true, true] },
  { label: 'Hỗ trợ', keys: ['support', 'Tự phục vụ', 'Email', 'Email', 'Priority', 'Dedicated'] },
  { label: 'VAT', keys: ['vat', false, false, false, true, true] },
];

function CompareTable({ plans }: { plans: BillingPlatformPlanView[] }) {
  const visible = plans.filter((p) => p.isActive);
  // Map plan index to cell value key pattern
  const planCodes = visible.map((p) => p.code);
  const featuredIdx = visible.findIndex((p) => p.isFeatured);

  return (
    <section id="compare" className="bg-slate-50 py-14 sm:py-20 scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold text-[#072348] sm:text-3xl">So sánh gói</h2>
          <p className="mt-2 text-sm text-slate-500">
            Chọn gói phù hợp với nhu cầu tuyển dụng của bạn.
          </p>
        </div>

        {/* Desktop table */}
        <div className="hidden lg:block">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-left font-semibold text-slate-600" scope="col">
                    Tính năng
                  </th>
                  {visible.map((p) => (
                    <th
                      key={p.id}
                      scope="col"
                      className={clsx(
                        'px-4 py-3 text-center',
                        p.isFeatured
                          ? 'bg-amber-50 text-[#072348]'
                          : 'text-slate-600'
                      )}
                    >
                      {p.code === 'ENTERPRISE' ? (
                        <span className="font-bold">Enterprise</span>
                      ) : (
                        <span className="font-bold">{p.name}</span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_FEATURES.map((row, ri) => (
                  <tr
                    key={row.label}
                    className={clsx(
                      'border-b border-slate-100',
                      ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                    )}
                  >
                    <td className="px-4 py-3 font-medium text-slate-700">{row.label}</td>
                    {row.keys.map((val, ci) => {
                      const cell = typeof val === 'string' ? val : '';
                      return (
                        <td
                          key={ci}
                          className={clsx(
                            'px-4 py-3 text-center',
                            visible[ci]?.isFeatured ? 'bg-amber-50/50' : ''
                          )}
                        >
                          {val === true ? (
                            <Check className="mx-auto h-4 w-4 text-emerald-500" />
                          ) : val === false ? (
                            <X className="mx-auto h-4 w-4 text-slate-300" />
                          ) : (
                            <span className="text-xs font-medium text-slate-600">{cell}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile: card list */}
        <div className="flex flex-col gap-4 lg:hidden">
          {visible.map((p) => (
            <div
              key={p.id}
              className={clsx(
                'rounded-2xl border p-5',
                p.isFeatured
                  ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-400'
                  : 'border-slate-200 bg-white'
              )}
            >
              <h3 className="text-base font-bold text-[#072348]">{p.name}</h3>
              <div className="mt-3 space-y-1.5">
                {COMPARE_FEATURES.slice(0, 6).map((row) => {
                  const idx = visible.indexOf(p);
                  const val = row.keys[idx];
                  return (
                    <div key={row.label} className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">{row.label}</span>
                      {val === true ? (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      ) : val === false ? (
                        <X className="h-3.5 w-3.5 text-slate-300" />
                      ) : (
                        <span className="font-medium text-slate-700">
                          {typeof val === 'string' ? val : ''}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// CONTACT CTA
// ============================================================================
function ContactCTASection() {
  const channels = [
    {
      icon: Mail,
      label: 'Email',
      value: 'sales@inlink.vn',
      href: 'mailto:sales@inlink.vn',
      desc: 'Phản hồi trong 24h',
    },
    {
      icon: Phone,
      label: 'Hotline',
      value: '1900 6868',
      href: 'tel:19006868',
      desc: 'T2–T6, 8h–17h',
      isTodo: true,
    },
    {
      icon: MessageCircle,
      label: 'Zalo OA',
      value: 'inlink.vn',
      href: 'https://zalo.me/inlink',
      desc: 'Nhắn tin nhanh',
      isTodo: true,
    },
  ];

  return (
    <section id="contact" className="bg-white py-14 sm:py-20 scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#072348] to-[#0d3b80] p-8 text-white sm:p-12">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">
              Cần tư vấn gói riêng cho doanh nghiệp?
            </h2>
            <p className="mt-3 text-sm text-slate-300">
              Đội ngũ iLink sẵn sàng hỗ trợ bạn chọn gói phù hợp nhất.
            </p>

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
                  <p className="mt-1 text-sm font-bold text-white">
                    {ch.value}
                    {ch.isTodo && (
                      <span className="ml-1 text-[10px] font-normal italic text-amber-300">
                        (TODO)
                      </span>
                    )}
                  </p>
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
function FooterMini() {
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
            <p className="text-xs text-slate-500">Kết nối nhân tài – Dẫn lối công nghiệp</p>
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
function MobileBottomBar() {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md lg:hidden"
      aria-label="Liên hệ nhanh"
    >
      <div className="flex items-center gap-2">
        <a
          href="tel:19006868"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#072348] py-3 text-xs font-bold text-white transition-colors hover:bg-[#0d3b80]"
        >
          {/* TODO: cập nhật hotline thực tế */}
          <Phone className="h-3.5 w-3.5" />
          Gọi ngay
        </a>
        <a
          href="https://zalo.me/inlink"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-500 py-3 text-xs font-bold text-white transition-colors hover:bg-blue-400"
        >
          {/* TODO: cập nhật link Zalo thực tế */}
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
function ZaloFAB() {
  return (
    <a
      href="https://zalo.me/inlink"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Liên hệ Zalo"
      className="fixed bottom-20 right-5 z-40 hidden lg:flex"
    >
      {/* TODO: cập nhật link Zalo thực tế */}
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
  planCtaHref,
  freeCtaHref,
  enterpriseCtaHref,
}: {
  plans: BillingPlatformPlanView[];
  currency: BillingCurrencyDisplay;
  enterprise: BillingPlatformPlanView | undefined;
  onSourcing: () => void;
  onTopup: () => void;
  isRecruiter: boolean;
  planCtaHref: (code: string) => string;
  freeCtaHref: () => string;
  enterpriseCtaHref: () => string;
}) {
  const visible = plans.filter((p) => p.isActive);

  return (
    <div>
      {/* Section header */}
      <div className="mb-8 text-center">
        <h2 id="pricing" className="text-2xl font-bold text-[#072348] sm:text-3xl scroll-mt-20">
          Gói nền tảng
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Tự tuyển dụng với AI Matching. Quản lý JD, ứng viên, mở hồ sơ tiềm năng.
        </p>
      </div>

      {/* Cards grid */}
      <div className="grid gap-4 lg:grid-cols-5 md:grid-cols-3 sm:grid-cols-2">
        {visible.map((p) => (
          <PlatformPlanCard
            key={p.id}
            plan={p}
            currency={currency}
            isRecruiter={isRecruiter}
            planCtaHref={planCtaHref}
            freeCtaHref={freeCtaHref}
            enterpriseCtaHref={enterpriseCtaHref}
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
            <a
              href={enterpriseCtaHref()}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-amber-500 px-4 text-sm font-bold text-[#072348] transition-colors hover:bg-amber-400"
            >
              {isRecruiter ? 'Yêu cầu tư vấn' : 'Liên hệ tư vấn'}{' '}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
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
  planCtaHref,
  freeCtaHref,
  enterpriseCtaHref,
}: {
  plan: BillingPlatformPlanView;
  currency: BillingCurrencyDisplay;
  isRecruiter: boolean;
  planCtaHref: (code: string) => string;
  freeCtaHref: () => string;
  enterpriseCtaHref: () => string;
}) {
  const isFree = plan.code === 'KHAM_PHA';
  const isEnterprise = plan.code === 'ENTERPRISE';
  const featured = plan.isFeatured;

  return (
    <div
      className={clsx(
        'relative flex flex-col rounded-2xl bg-white p-5 ring-1 transition',
        featured
          ? 'ring-2 ring-amber-400 shadow-xl shadow-amber-500/10'
          : 'ring-slate-200 hover:shadow-md hover:ring-slate-300'
      )}
    >
      {featured ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#072348] shadow-md">
          <Star className="h-2.5 w-2.5 fill-current" /> Phổ biến nhất
        </span>
      ) : null}

      <h3 className="text-base font-bold text-slate-900">{plan.name}</h3>
      {plan.description ? (
        <p className="mt-1 text-[12px] leading-relaxed text-slate-500">{plan.description}</p>
      ) : null}

      <div className="mt-4">
        {isEnterprise ? (
          <p className="text-2xl font-bold text-[#072348]">Báo giá</p>
        ) : isFree ? (
          <>
            <p className="text-3xl font-bold text-[#072348]">Miễn phí</p>
            <p className="text-[11px] text-slate-400">Không giới hạn thời gian trải nghiệm</p>
          </>
        ) : (
          <>
            <p className="text-3xl font-bold tabular-nums text-[#072348]">
              {formatPriceVnd(plan.priceVnd, currency)}
            </p>
            <p className="text-[11px] text-slate-500">
              {UNIT_LABEL[plan.billingUnit]}
              {plan.durationDays ? ` · ${plan.durationDays} ngày` : ''}
            </p>
            {currency.showReferenceUsd ? (
              <p className="mt-0.5 text-[10px] text-slate-400">
                {formatReferenceUsd(plan.priceVnd, currency)}
              </p>
            ) : null}
          </>
        )}
      </div>

      <ul className="mt-4 flex-1 space-y-1.5">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[12px] text-slate-600">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
            <span>{f}</span>
          </li>
        ))}
        {plan.creditQuota != null && plan.creditQuota > 0 ? (
          <li className="flex items-start gap-1.5 text-[12px] font-semibold text-amber-700">
            <Coins className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Tặng {plan.creditQuota} Credit mở hồ sơ</span>
          </li>
        ) : null}
        {plan.jobPostQuota != null ? (
          <li className="flex items-start gap-1.5 text-[12px] text-slate-600">
            <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>{plan.jobPostQuota} JD / gói</span>
          </li>
        ) : plan.jobPostQuota == null && !isFree && !isEnterprise ? (
          <li className="flex items-start gap-1.5 text-[12px] text-slate-600">
            <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>JD không giới hạn</span>
          </li>
        ) : null}
      </ul>

      <Link
        href={isEnterprise ? enterpriseCtaHref() : isFree ? freeCtaHref() : planCtaHref(plan.code)}
        className={clsx(
          'mt-5 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-sm font-bold transition',
          featured
            ? 'bg-amber-500 text-[#072348] hover:bg-amber-400'
            : isFree
              ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              : 'bg-[#072348] text-white hover:bg-[#0d3b80]'
        )}
      >
        {isEnterprise
          ? isRecruiter
            ? 'Yêu cầu tư vấn'
            : 'Liên hệ sales'
          : isFree
            ? isRecruiter
              ? 'Dùng thử miễn phí'
              : 'Đăng ký miễn phí'
            : isRecruiter
              ? 'Kích hoạt gói'
              : 'Chọn gói'}{' '}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
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
}: {
  plans: BillingSourcingPlanView[];
  currency: BillingCurrencyDisplay;
  onTopup: () => void;
  isRecruiter: boolean;
  planCtaHref: (code: string) => string;
}) {
  return (
    <div>
      <div className="mb-8 text-center">
        <h2 id="sourcing" className="text-2xl font-bold text-[#072348] sm:text-3xl scroll-mt-20">
          Gói Săn nhân sự
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Đội ngũ iLink trực tiếp tìm kiếm, sàng lọc và đánh giá ứng viên theo JD của bạn.
        </p>
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
        'relative flex flex-col rounded-2xl bg-white p-6 ring-1 transition',
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

      <div className="mt-4">
        <p className="text-3xl font-bold tabular-nums text-[#072348]">
          {formatPriceVnd(plan.feeVnd, currency)}
        </p>
        <p className="text-[11px] text-slate-500">Phí dịch vụ / vị trí</p>
        {currency.showReferenceUsd ? (
          <p className="mt-0.5 text-[10px] text-slate-400">
            {formatReferenceUsd(plan.feeVnd, currency)}
          </p>
        ) : null}
      </div>

      {/* Quota grid */}
      <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-center">
        <QuotaItem label="Vị trí" value={plan.positionQuota} />
        <QuotaItem label="Đợt tìm" value={plan.searchRoundQuota} />
        <QuotaItem label="Shortlist" value={plan.shortlistQuota} />
        <QuotaItem label="Điều chỉnh" value={plan.revisionQuota} />
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
        Đăng ký Săn <ArrowRight className="h-3.5 w-3.5" />
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
}: {
  topups: BillingCreditTopupView[];
  currency: BillingCurrencyDisplay;
  topupCtaHref: (id: string) => string;
}) {
  return (
    <div>
      <div className="mb-8 text-center">
        <h2 id="credit" className="text-2xl font-bold text-[#072348] sm:text-3xl scroll-mt-20">
          Top-up Credit
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Mua thêm lượt mở hồ sơ tiềm năng. Đơn giá giảm khi mua nhiều.
        </p>
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
        'relative flex flex-col rounded-2xl bg-white p-6 ring-1 transition',
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

      <div className="mt-4">
        <p className="text-3xl font-bold tabular-nums text-[#072348]">
          {formatPriceVnd(topup.priceVnd, currency)}
        </p>
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
function TrustItems() {
  return (
    <section className="bg-white py-10 sm:py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <TrustItem
            icon={Shield}
            title="Không auto-charge"
            desc="Hệ thống không tự động mua Credit. Bạn chủ động quyết định."
          />
          <TrustItem
            icon={Banknote}
            title="Hoá đơn VAT"
            desc="Xuất VAT đầy đủ cho doanh nghiệp. Hỗ trợ chuyển khoản."
          />
          <TrustItem
            icon={Sparkles}
            title="Hỗ trợ 1-1"
            desc="Đội ngũ iLink đồng hành setup, training và tối ưu JD."
          />
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
function FAQSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <section id="faq" className="bg-slate-50 py-14 sm:py-20 scroll-mt-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold text-[#072348] sm:text-3xl">Câu hỏi thường gặp</h2>
          <p className="mt-2 text-sm text-slate-500">Mọi thắc mắc về giá, gói và Credit.</p>
        </div>
        <div className="space-y-2">
          {FAQ.map((item, i) => {
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
                    {item.a}
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
function FinalCTA({ isRecruiter }: { isRecruiter: boolean }) {
  return (
    <section className="bg-gradient-to-br from-[#072348] to-[#0d3b80] py-12 text-white">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
        <h2 className="text-2xl font-bold sm:text-3xl">Sẵn sàng tuyển hiệu quả hơn?</h2>
        <p className="mt-2 text-sm text-slate-300">
          Đăng ký miễn phí hoặc liên hệ sales để được tư vấn gói phù hợp.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-500 px-6 text-sm font-bold text-[#072348] shadow-lg shadow-amber-500/30 transition-colors hover:bg-amber-400"
          >
            Đăng ký miễn phí <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="mailto:sales@inlink.vn"
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

// ============================================================================
// STATS HELPER (plain function — not a hook, safe to call conditionally)
// ============================================================================
function computeStats(config: BillingPublicConfig) {
  const platformActive = config.platformPlans.filter((p) => p.isActive && p.code !== 'ENTERPRISE');
  const cheapestTopup = [...config.creditTopups]
    .filter((p) => p.isActive)
    .sort((a, b) => Number(BigInt(a.priceVnd) - BigInt(b.priceVnd)))[0];
  // Tính saving: giả định unitPrice 20l=62.5k, 100l=50k → 20% saving
  const savingPct = cheapestTopup ? 20 : undefined;
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
}: {
  config: BillingPublicConfig | null;
  context?: 'recruiter' | 'public';
}) {
  const isRecruiter = context === 'recruiter';

  /** Href CTA cho gói */
  const planCtaHref = (code: string) =>
    isRecruiter ? `/recruiter/billing?plan=${encodeURIComponent(code)}` : '/register';
  const freeCtaHref = () => (isRecruiter ? '/recruiter?action=try-free' : '/register');
  const enterpriseCtaHref = () =>
    isRecruiter ? '/recruiter/billing?plan=ENTERPRISE' : 'mailto:sales@inlink.vn';
  /** Top-up: dùng id vì view không có code. */
  const topupCtaHref = (id: string) =>
    isRecruiter ? `/recruiter/billing/credit?topup=${encodeURIComponent(id)}` : '/register';

  // Tab state — hooks must come before any conditional returns
  const [tab, setTab] = useState<'platform' | 'sourcing' | 'credit'>('platform');

  // Compute stats after hooks, then early-return if no config
  const stats = config ? computeStats(config) : null;

  if (!config) return <PricingSkeleton />;

  const cur = config.currency;
  const enterprise = config.platformPlans.find((p) => p.code === 'ENTERPRISE' && p.isActive);

  return (
    <>
      {/* HTML scroll behavior */}
      <style>{`html { scroll-behavior: smooth; }`}</style>

      {/* TOP NAV (public only) */}
      {!isRecruiter && <TopNav />}

      {/* HERO */}
      {isRecruiter ? <HeroRecruiter /> : <HeroPublic stats={stats} />}

      {/* SECTION NAV */}
      <SectionNav isRecruiter={isRecruiter} />

      {/* CONTENT */}
      <section className="bg-slate-50 py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {tab === 'platform' ? (
            <PlatformPlansView
              plans={config.platformPlans}
              currency={cur}
              enterprise={enterprise}
              onSourcing={() => setTab('sourcing')}
              onTopup={() => setTab('credit')}
              isRecruiter={isRecruiter}
              planCtaHref={planCtaHref}
              freeCtaHref={freeCtaHref}
              enterpriseCtaHref={enterpriseCtaHref}
            />
          ) : tab === 'sourcing' ? (
            <SourcingPlansView
              plans={config.sourcingPlans}
              currency={cur}
              onTopup={() => setTab('credit')}
              isRecruiter={isRecruiter}
              planCtaHref={planCtaHref}
            />
          ) : (
            <CreditTopupView topups={config.creditTopups} currency={cur} topupCtaHref={topupCtaHref} />
          )}
        </div>
      </section>

      {/* FEATURES (public only) */}
      {!isRecruiter && <FeaturesSection />}

      {/* COMPARE (public only) */}
      {!isRecruiter && <CompareTable plans={config.platformPlans} />}

      {/* HOW IT WORKS (public only) */}
      {!isRecruiter && <HowItWorksSection />}

      {/* TRUST */}
      <TrustItems />

      {/* FAQ (public only) */}
      {!isRecruiter && <FAQSection />}

      {/* CONTACT CTA (public only) */}
      {!isRecruiter && <ContactCTASection />}

      {/* FINAL CTA */}
      <FinalCTA isRecruiter={isRecruiter} />

      {/* FOOTER MINI (public only) */}
      {!isRecruiter && <FooterMini />}

      {/* FLOATING ZALO FAB (public only) */}
      {!isRecruiter && <ZaloFAB />}

      {/* MOBILE BOTTOM BAR (public only) */}
      {!isRecruiter && <MobileBottomBar />}

      {/* Bottom padding for mobile nav */}
      {!isRecruiter && <div className="h-16 lg:hidden" aria-hidden="true" />}
    </>
  );
}
