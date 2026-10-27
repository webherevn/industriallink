/**
 * Seed cho module Billing & Pricing.
 *
 * Khởi tạo cấu hình V1 theo tài liệu LOGIC FINAL V3:
 *  - 5 gói nền tảng (Tầng 1): KHAM_PHA, TIN_DANG, TIN_DANG_PLUS, DOANH_NGHIEP, ENTERPRISE
 *  - 3 gói Săn (Tầng 2): SAN_CO_BAN, SAN_TIEU_CHUAN, SAN_CHUYEN_SAU
 *  - 3 gói top-up Credit: 20/50/100 lượt
 *  - 1 row policy (scope="default") theo nguyên tắc V1
 *  - 1 row currency config (scope="default", VND, ký hiệu "$")
 *
 * Chạy: pnpm exec tsx prisma/seed-billing.ts
 *   hoặc: pnpm exec dotenv -e .env -- tsx prisma/seed-billing.ts
 *
 * Idempotent: dùng upsert theo code/scope — chạy nhiều lần không tạo bản ghi trùng.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// 1) PLATFORM PLANS (Tầng 1)
// ============================================================================
// Tỉ giá tham chiếu V1 tài liệu: $1 = 25,000 VND (cố định do iLink đặt).
// Tất cả giá lưu DB dạng VND integer.
const VND_PER_USD = 25_000;

const PLATFORM_PLANS = [
  {
    code: 'KHAM_PHA',
    name: 'Khám phá',
    description: 'Dùng thử 14 ngày, tối đa 1 tin. Không tự chuyển sang gói trả phí.',
    priceVnd: 0n,
    billingUnit: 'per_jd',
    durationDays: 14,
    jobPostQuota: 1,
    creditQuota: 0,
    sortOrder: 1,
    isFeatured: false,
    features: [
      'Phân tích JD bằng AI',
      'Sửa tiêu chí không giới hạn trong 14 ngày',
      'Xem tổng số và phân bổ mức phù hợp',
      'Xem trước hồ sơ giới hạn, không mở danh tính',
      '0 lượt mở hồ sơ tiềm năng',
    ],
  },
  {
    code: 'TIN_DANG',
    name: 'Tin đăng',
    description: '1 tin trong 30 ngày, 10 lượt mở hồ sơ tiềm năng.',
    priceVnd: 3_990_000n,
    billingUnit: 'per_jd',
    durationDays: 30,
    jobPostQuota: 1,
    creditQuota: 10,
    sortOrder: 2,
    isFeatured: false,
    features: [
      '1 tin đăng trong 30 ngày',
      '10 lượt mở hồ sơ tiềm năng',
      'Hồ sơ ứng tuyển và tổng Matching không tốn lượt',
      'Mở lại hồ sơ đã xem không tốn thêm lượt',
    ],
  },
  {
    code: 'TIN_DANG_PLUS',
    name: 'Tin đăng Plus',
    description: 'Thêm 20 lượt so với Tin đăng, chênh 1.000.000 đồng.',
    priceVnd: 4_990_000n,
    billingUnit: 'per_jd',
    durationDays: 30,
    jobPostQuota: 1,
    creditQuota: 30,
    sortOrder: 3,
    isFeatured: true,
    features: [
      '1 tin đăng trong 30 ngày',
      '30 lượt mở hồ sơ tiềm năng',
      'Thêm 20 lượt so với Tin đăng',
      'Hồ sơ ứng tuyển không tốn lượt',
    ],
  },
  {
    code: 'DOANH_NGHIEP',
    name: 'Doanh nghiệp',
    description: 'Tối đa 5 tin đang hoạt động, 50 lượt mở hồ sơ dùng chung mỗi tháng.',
    priceVnd: 10_990_000n,
    billingUnit: 'per_month',
    durationDays: 30,
    jobPostQuota: 5,
    creditQuota: 50,
    sortOrder: 4,
    isFeatured: false,
    features: [
      'Tối đa 5 tin đang hoạt động',
      '50 lượt mở hồ sơ dùng chung mỗi tháng',
      'Tin đã đóng hoặc bản nháp không tính vào hạn mức',
      'Không gồm tìm kiếm và liên hệ ứng viên của iLink',
    ],
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'Báo giá riêng. Hạn mức tin và lượt mở theo hợp đồng.',
    priceVnd: 0n, // hiển thị "Báo giá" — UI sẽ check code = ENTERPRISE
    billingUnit: 'per_month',
    durationDays: null,
    jobPostQuota: null,
    creditQuota: null,
    sortOrder: 5,
    isFeatured: false,
    features: [
      'Báo giá riêng theo nhu cầu',
      'Hạn mức tin và lượt mở theo hợp đồng',
      'Hỗ trợ triển khai riêng',
    ],
  },
];

// ============================================================================
// 2) SOURCING PLANS (Tầng 2)
// ============================================================================
const SOURCING_PLANS = [
  {
    code: 'SAN_CO_BAN',
    name: 'Tin săn Cơ bản',
    description: '30 ngày, 30 lượt mở. iLink thiết lập tiêu chí một lần và báo cáo cuối kỳ. Nhà tuyển dụng tự liên hệ.',
    feeVnd: 5_990_000n,
    positionQuota: 1,
    searchRoundQuota: 1,
    shortlistQuota: null,
    revisionQuota: 1,
    creditQuota: 30,
    sortOrder: 1,
    isFeatured: false,
    serviceScope: ['ai_match', 'filter_rank', 'shortlist'],
  },
  {
    code: 'SAN_TIEU_CHUAN',
    name: 'Tin săn Tiêu chuẩn',
    description: 'Gồm Tin săn Cơ bản, thêm 1 buổi làm rõ, tối đa 3 lần sửa tiêu chí và 4 báo cáo tuần. iLink không gọi ứng viên.',
    feeVnd: 7_990_000n,
    positionQuota: 1,
    searchRoundQuota: 4,
    shortlistQuota: null,
    revisionQuota: 3,
    creditQuota: 30,
    sortOrder: 2,
    isFeatured: true,
    serviceScope: ['ai_match', 'filter_rank', 'shortlist', 'strengths_gaps', 'priority'],
  },
  {
    code: 'SAN_CHUYEN_SAU',
    name: 'Tin săn Chuyên sâu',
    description: '50 lượt mở. iLink liên hệ tối đa 15 ứng viên, mỗi người tối đa 2 lần. 15 là hạn mức, không phải cam kết phản hồi.',
    feeVnd: 12_990_000n,
    positionQuota: 1,
    searchRoundQuota: 4,
    shortlistQuota: 15,
    revisionQuota: 3,
    creditQuota: 50,
    sortOrder: 3,
    isFeatured: false,
    serviceScope: ['ai_match', 'filter_rank', 'shortlist', 'strengths_gaps', 'priority', 'outreach', 'follow_up'],
  },
];

// ============================================================================
// 3) CREDIT TOP-UP
// ============================================================================
function vnd(usd: number): bigint {
  return BigInt(usd * VND_PER_USD);
}
const CREDIT_TOPUPS = [
  {
    name: '20 lượt',
    creditCount: 20,
    priceVnd: vnd(50), // 1,250,000 → đơn giá 62,500 VND/lượt (~$2.50)
    unitPriceVnd: vnd(50) / 20n,
    badge: null,
    sortOrder: 1,
    isFeatured: false,
  },
  {
    name: '50 lượt',
    creditCount: 50,
    priceVnd: vnd(110), // 2,750,000 → 55,000 VND/lượt (~$2.20)
    unitPriceVnd: vnd(110) / 50n,
    badge: 'Tiết kiệm 12%',
    sortOrder: 2,
    isFeatured: true,
  },
  {
    name: '100 lượt',
    creditCount: 100,
    priceVnd: vnd(200), // 5,000,000 → 50,000 VND/lượt (~$2.00)
    unitPriceVnd: vnd(200) / 100n,
    badge: 'Phổ biến nhất',
    sortOrder: 3,
    isFeatured: false,
  },
];

// ============================================================================
// 4) CREDIT POLICY (V1)
// ============================================================================
const CREDIT_POLICY = {
  scope: 'default',
  costPerProfile: 1,                     // 1 hồ sơ tiềm năng = 1 Credit
  costPerReopen: 0,                      // mở lại = 0
  costPerApplicant: 0,                   // UV chủ động = 0
  costPerContactPotential: 0,            // liên hệ UV tiềm năng = 0
  costPerContactApplicant: 0,            // liên hệ UV chủ động = 0
  costPerMatchSummary: 0,                // tổng Matching = 0
  allowAutoPurchase: false,              // KHÔNG auto-charge (nguyên tắc #8)
  defaultBudgetVnd: null,                // không giới hạn
  warnWhenBelowPercent: 20,              // cảnh báo khi dưới 20%
  allowBudgetOverspend: false,           // không vượt ngân sách
  expireWhenInactive: false,             // không hết hạn khi TK hoạt động
  inactiveDays: null,
  allowRefund: false,                    // chỉ hoàn khi lỗi hệ thống
};

// ============================================================================
// 5) CURRENCY CONFIG (VND + display "$")
// ============================================================================
const CURRENCY_CONFIG = {
  scope: 'default',
  currencyCode: 'VND',
  displaySymbol: 'VNĐ',
  symbolBefore: false,                   // 1,225,000VNĐ
  useThousandsSeparator: true,           // 1,200,000
  thousandsSeparator: ',',
  decimalDigits: 0,                      // VND không có lẻ
  showReferenceUsd: false,               // ẩn so sánh USD mặc định
  referenceUsdRate: null,
  // $1 = 25,000 VND = 2,500,000 (× 100 để tránh sai số)
  usdToVndRateHundredths: BigInt(VND_PER_USD) * 100n,
};

// ============================================================================
// MAIN
// ============================================================================
async function upsertPlatformPlans() {
  console.log('Seeding platform plans...');
  for (const p of PLATFORM_PLANS) {
    await prisma.billingPlatformPlan.upsert({
      where: { code: p.code },
      create: p,
      update: {
        name: p.name,
        description: p.description,
        priceVnd: p.priceVnd,
        billingUnit: p.billingUnit,
        durationDays: p.durationDays,
        jobPostQuota: p.jobPostQuota,
        creditQuota: p.creditQuota,
        sortOrder: p.sortOrder,
        isFeatured: p.isFeatured,
        features: p.features as Prisma.JsonArray,
      },
    });
  }
}

async function upsertSourcingPlans() {
  console.log('Seeding sourcing plans...');
  for (const s of SOURCING_PLANS) {
    await prisma.billingSourcingPlan.upsert({
      where: { code: s.code },
      create: s,
      update: {
        name: s.name,
        description: s.description,
        feeVnd: s.feeVnd,
        positionQuota: s.positionQuota,
        searchRoundQuota: s.searchRoundQuota,
        shortlistQuota: s.shortlistQuota,
        revisionQuota: s.revisionQuota,
        creditQuota: s.creditQuota,
        serviceScope: s.serviceScope as Prisma.JsonArray,
        sortOrder: s.sortOrder,
        isFeatured: s.isFeatured,
      },
    });
  }
}

async function upsertCreditTopups() {
  console.log('Seeding credit top-ups...');
  for (const t of CREDIT_TOPUPS) {
    // Tìm record đầu tiên cùng creditCount để upsert (vì không có mã cố định)
    const existing = await prisma.billingCreditTopup.findFirst({
      where: { creditCount: t.creditCount },
    });
    if (existing) {
      await prisma.billingCreditTopup.update({
        where: { id: existing.id },
        data: {
          name: t.name,
          priceVnd: t.priceVnd,
          unitPriceVnd: t.unitPriceVnd,
          badge: t.badge,
          sortOrder: t.sortOrder,
          isFeatured: t.isFeatured,
        },
      });
    } else {
      await prisma.billingCreditTopup.create({ data: t });
    }
  }
}

async function upsertCreditPolicy() {
  console.log('Seeding credit policy...');
  await prisma.billingCreditPolicy.upsert({
    where: { scope: CREDIT_POLICY.scope },
    create: CREDIT_POLICY,
    update: { ...CREDIT_POLICY, scope: undefined },
  });
}

async function upsertCurrencyConfig() {
  console.log('Seeding currency config...');
  await prisma.billingCurrencyConfig.upsert({
    where: { scope: CURRENCY_CONFIG.scope },
    create: CURRENCY_CONFIG,
    update: { ...CURRENCY_CONFIG, scope: undefined },
  });
}

const PAGE_CONTENT_LISTS = {
  features: [
    { title: 'AI Matching thông minh', desc: 'Thuật toán AI phân tích JD, tìm ứng viên phù hợp. Matching chính xác, tiết kiệm 70% thời gian sàng lọc.' },
    { title: 'Tạo JD từ template', desc: 'Template chuẩn công nghiệp, điền thông tin và nhận JD hoàn chỉnh chỉ trong 3 phút.' },
    { title: 'Mở hồ sơ tiềm năng', desc: 'Dùng Credit để mở hồ sơ ứng viên tiềm năng. Không auto-charge, chủ động kiểm soát chi phí.' },
    { title: 'Nhiều user cùng dùng', desc: 'Gói Doanh nghiệp & Enterprise hỗ trợ nhiều tài khoản nhà tuyển dụng cùng lúc.' },
    { title: 'Báo cáo hiệu quả', desc: 'Dashboard thống kê views, ứng tuyển, matching rate. Theo dõi ROI tuyển dụng dễ dàng.' },
    { title: 'Top-up Credit linh hoạt', desc: 'Mua Credit theo nhu cầu thực tế. Đơn giá giảm khi mua nhiều. Không hết hạn khi tài khoản còn hoạt động.' },
  ],
  howSteps: [
    { title: 'Chọn gói phù hợp', desc: 'Từ gói miễn phí Khám phá đến Enterprise — chọn gói phù hợp quy mô và nhu cầu tuyển dụng của bạn.' },
    { title: 'Đăng JD & Matching AI', desc: 'Tạo JD bằng template hoặc paste nội dung. AI sẽ tự động phân tích và matching ứng viên phù hợp.' },
    { title: 'Mua thêm Credit khi cần', desc: 'Mở hồ sơ ứng viên tiềm năng bằng Credit. Mua thêm bất kỳ lúc nào, đơn giá giảm theo số lượng.' },
  ],
  faqItems: [
    { q: 'Giá đã bao gồm VAT chưa?', a: 'Giá hiển thị chưa bao gồm VAT. Mức thuế suất chưa được đặt. Hoá đơn VAT được xuất theo yêu cầu khi thanh toán.' },
    { q: 'Tôi có thể đổi từ Tin đăng sang Tin đăng Plus không?', a: 'Có. Vào trang quản lý gói, chọn "Nâng cấp" và phần chênh lệch sẽ được tính theo tỉ lệ thời gian còn lại.' },
    { q: 'Credit mua thêm có hết hạn không?', a: 'Theo chính sách hiện tại, Credit không hết hạn khi tài khoản còn hoạt động. Chúng tôi sẽ thông báo trước 30 ngày nếu có thay đổi.' },
    { q: 'Phí Săn nhân sự có bao gồm lượt mở hồ sơ không?', a: 'Có. Tin săn Cơ bản và Tiêu chuẩn gồm 30 lượt, Tin săn Chuyên sâu gồm 50 lượt cho vị trí đó. Mua thêm lượt là việc riêng và không được giảm giá.' },
    { q: 'iLink có auto-charge Credit khi hết không?', a: 'Không. Theo nguyên tắc V1, hệ thống không tự động mua Credit. Bạn chủ động mua khi cần.' },
    { q: 'Có hỗ trợ thanh toán qua chuyển khoản ngân hàng không?', a: 'Có. Doanh nghiệp và Enterprise hỗ trợ chuyển khoản, xuất hoá đơn VAT. Liên hệ sales@inlink.vn để được hỗ trợ.' },
  ],
  trustItems: [
    { title: 'Không auto-charge', desc: 'Hệ thống không tự động mua Credit. Bạn chủ động quyết định.' },
    { title: 'Hoá đơn VAT', desc: 'Xuất VAT đầy đủ cho doanh nghiệp. Hỗ trợ chuyển khoản.' },
    { title: 'Hỗ trợ 1-1', desc: 'Đội ngũ iLink đồng hành setup, training và tối ưu JD.' },
  ],
};

async function upsertPageContent() {
  console.log('Seeding page content (chỉ tạo nếu chưa có)...');
  await prisma.billingPageContent.upsert({
    where: { scope: 'default' },
    create: {
      scope: 'default',
      features: PAGE_CONTENT_LISTS.features as Prisma.JsonArray,
      howSteps: PAGE_CONTENT_LISTS.howSteps as Prisma.JsonArray,
      faqItems: PAGE_CONTENT_LISTS.faqItems as Prisma.JsonArray,
      trustItems: PAGE_CONTENT_LISTS.trustItems as Prisma.JsonArray,
    },
    update: {},
  });
  const row = await prisma.billingPageContent.findUnique({ where: { scope: 'default' } });
  const faq = Array.isArray(row?.faqItems) ? (row.faqItems as { q?: string; a?: string }[]) : [];
  const next = faq.map((item) =>
    item.q === 'Phí Săn nhân sự có bao gồm Credit không?'
      ? PAGE_CONTENT_LISTS.faqItems[3]
      : item,
  );
  const changed = next.some((item, i) => item !== faq[i]);
  if (changed && row) {
    await prisma.billingPageContent.update({
      where: { scope: 'default' },
      data: { faqItems: next as Prisma.JsonArray },
    });
  }
}

const DEFAULT_PLAN_COSTS: { action: string; cost: number }[] = [
  { action: 'view_profile', cost: CREDIT_POLICY.costPerProfile },
  { action: 'reopen_profile', cost: CREDIT_POLICY.costPerReopen },
  { action: 'view_applicant', cost: CREDIT_POLICY.costPerApplicant },
  { action: 'contact_potential', cost: CREDIT_POLICY.costPerContactPotential },
  { action: 'contact_applicant', cost: CREDIT_POLICY.costPerContactApplicant },
  { action: 'view_match_summary', cost: CREDIT_POLICY.costPerMatchSummary },
];

async function upsertPlanActionCosts() {
  console.log('Seeding plan action costs...');
  const plans = await prisma.billingPlatformPlan.findMany({ select: { id: true, code: true } });
  for (const plan of plans) {
    for (const row of DEFAULT_PLAN_COSTS) {
      await prisma.billingPlanActionCost.upsert({
        where: { planId_action: { planId: plan.id, action: row.action } },
        create: { planId: plan.id, action: row.action, cost: row.cost, isActive: true },
        update: { cost: row.cost, isActive: true },
      });
    }
  }
}

async function main() {
  await upsertPlatformPlans();
  await upsertSourcingPlans();
  await upsertCreditTopups();
  await upsertCreditPolicy();
  await upsertCurrencyConfig();
  await upsertPageContent();
  await upsertPlanActionCosts();
  console.log('\n✓ Billing seed done.');
  console.log(`  ${PLATFORM_PLANS.length} platform plans`);
  console.log(`  ${SOURCING_PLANS.length} sourcing plans`);
  console.log(`  ${CREDIT_TOPUPS.length} credit top-ups`);
  console.log('  1 credit policy row');
  console.log('  1 currency config row');
  console.log('  1 page content row');
  console.log(`  ${DEFAULT_PLAN_COSTS.length} action costs / plan`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
