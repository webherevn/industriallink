/**
 * Trang bảng giá — CHỈ dành cho NTD trên tuyendung.inlink.vn.
 *
 * SEO strategy:
 * - Trên tuyendung.inlink.vn → index, canonical tuyệt đối về tuyendung.inlink.vn/pricing
 * - Trên trang chủ inlink.vn (chỉ trong dev/local) → noindex, follow
 * - Middleware chặn NTD từ trang chủ vào /pricing → bounce về subdomain.
 *
 * Dữ liệu: /api/v1/billing/public-config (public, ISR 5 phút).
 */
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { PricingClient } from '@/components/pricing-client';
import { fetchPublicBillingConfig } from '@/lib/admin-billing';
import {
  isRecruiterHostname,
  recruiterSiteUrl,
  publicSiteUrl,
} from '@/lib/hosts';

export const revalidate = 300; // 5 phút

const FALLBACK_TITLE = 'Bảng giá dịch vụ — inlink';
const FALLBACK_DESC =
  'Bảng giá minh bạch cho nhà tuyển dụng: gói Tin đăng, Tin đăng Plus, Doanh nghiệp, Enterprise, dịch vụ Săn nhân sự và Top-up Credit. Không auto-charge, không phát sinh.';

function buildCanonical(hostname: string): string {
  const base = isRecruiterHostname(hostname) ? recruiterSiteUrl() : publicSiteUrl();
  return `${base}/pricing`;
}

export async function generateMetadata(): Promise<Metadata> {
  // Next 15: headers() là async
  const h = await headers();
  const hostname = h.get('host') ?? '';
  const onRecruiter = isRecruiterHostname(hostname);
  const canonical = buildCanonical(hostname);
  const title = onRecruiter
    ? 'Bảng giá dành cho nhà tuyển dụng — inlink Recruiter'
    : FALLBACK_TITLE;
  const description = onRecruiter
    ? 'Gói Tin đăng, Tin đăng Plus, Doanh nghiệp, Enterprise. Dịch vụ Săn nhân sự theo 8 phạm vi. Top-up Credit mở hồ sơ. Minh bạch, không auto-charge.'
    : FALLBACK_DESC;
  return {
    title,
    description,
    alternates: { canonical },
    // Trang chủ inlink.vn (không phải subdomain NTD): chặn index.
    // Subdomain tuyendung.inlink.vn: cho index.
    robots: onRecruiter
      ? { index: true, follow: true, 'max-image-preview': 'large' }
      : { index: false, follow: true, nocache: true },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonical,
      siteName: 'inlink',
      locale: 'vi_VN',
      images: [{ url: '/og-pricing.png', width: 1200, height: 630, alt: 'Bảng giá inlink' }],
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

// JSON-LD: Product + FAQPage + BreadcrumbList
export default async function PricingPage() {
  const h = await headers();
  const hostname = h.get('host') ?? '';
  const onRecruiter = isRecruiterHostname(hostname);

  let config: Awaited<ReturnType<typeof fetchPublicBillingConfig>> | null = null;
  try {
    config = await fetchPublicBillingConfig();
  } catch {
    // Render skeleton nếu API lỗi — không fail cả trang
  }

  const canonical = buildCanonical(hostname);

  // Build Product JSON-LD from active platform plans
  const productSchema = config
    ? config.platformPlans
        .filter((p) => p.isActive)
        .map((p) => ({
          '@type': 'Product',
          name: `${p.name} — inlink`,
          description: p.description ?? '',
          url: canonical,
          brand: { '@type': 'Brand', name: 'inlink' },
          offers: p.code === 'ENTERPRISE'
            ? { '@type': 'Offer', availability: 'https://schema.org/ContactSupplier', url: 'mailto:sales@inlink.vn' }
              : {
                '@type': 'Offer',
                price: (Number(BigInt(p.priceVnd)) / 1_000_000).toFixed(0),
                priceCurrency: 'VND',
                availability: 'https://schema.org/InStock',
                url: canonical,
              },
        }))
    : [];

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'Giá đã bao gồm VAT chưa?', acceptedAnswer: { '@type': 'Answer', text: 'Giá hiển thị chưa bao gồm VAT 10%. Hoá đơn VAT được xuất theo yêu cầu khi thanh toán.' } },
      { '@type': 'Question', name: 'Credit mua thêm có hết hạn không?', acceptedAnswer: { '@type': 'Answer', text: 'Theo chính sách hiện tại, Credit không hết hạn khi tài khoản còn hoạt động. Chúng tôi sẽ thông báo trước 30 ngày nếu có thay đổi.' } },
      { '@type': 'Question', name: 'iLink có auto-charge Credit khi hết không?', acceptedAnswer: { '@type': 'Answer', text: 'Không. Theo nguyên tắc V1, hệ thống không tự động mua Credit. Bạn chủ động mua khi cần.' } },
      { '@type': 'Question', name: 'Có hỗ trợ thanh toán qua chuyển khoản ngân hàng không?', acceptedAnswer: { '@type': 'Answer', text: 'Có. Doanh nghiệp và Enterprise hỗ trợ chuyển khoản, xuất hoá đơn VAT. Liên hệ sales@inlink.vn để được hỗ trợ.' } },
      { '@type': 'Question', name: 'Tôi có thể đổi từ Tin đăng sang Tin đăng Plus không?', acceptedAnswer: { '@type': 'Answer', text: 'Có. Vào trang quản lý gói, chọn "Nâng cấp" và phần chênh lệch sẽ được tính theo tỉ lệ thời gian còn lại.' } },
      { '@type': 'Question', name: 'Phí Săn nhân sự có bao gồm Credit không?', acceptedAnswer: { '@type': 'Answer', text: 'Không. Phí Săn (Cơ bản/Tiêu chuẩn/Chuyên sâu) là phí dịch vụ iLink thực hiện. Credit mua riêng theo nhu cầu mở hồ sơ tiềm năng.' } },
    ],
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: onRecruiter ? recruiterSiteUrl() : publicSiteUrl() },
      { '@type': 'ListItem', position: 2, name: 'Bảng giá', item: canonical },
    ],
  };

  const jsonLd = [
    ...(productSchema.length ? [{ '@context': 'https://schema.org', '@graph': productSchema }] : []),
    faqSchema,
    breadcrumbSchema,
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PricingClient config={config} context={onRecruiter ? 'recruiter' : 'public'} />
    </>
  );
}
