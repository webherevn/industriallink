import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Building2,
  Compass,
  FilePenLine,
  Home,
} from 'lucide-react';
import { PublicHeader } from '@/components/public-header';
import { SiteFooter } from '@/components/site-footer';
import { BRAND_RECRUITER_SITE_URL } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Không tìm thấy trang (404) | inLink',
  description:
    'Trang bạn tìm không còn tồn tại hoặc tin tuyển dụng đã ngừng nhận hồ sơ. Khám phá cơ hội việc làm công nghiệp mới nhất trên inLink.',
  robots: { index: false, follow: true },
};

const QUICK_LINKS = [
  {
    href: '/viec-lam',
    title: 'Tìm việc làm công nghiệp',
    desc: 'Khám phá hàng trăm cơ hội Kỹ thuật & Kinh doanh B2B đang tuyển.',
    icon: Briefcase,
    external: false,
  },
  {
    href: '/cv/create',
    title: 'Tạo CV & Hồ sơ AI',
    desc: 'Chuẩn hóa CV ngành công nghiệp nhanh trong 3 bước với AI.',
    icon: FilePenLine,
    external: false,
  },
  {
    href: '/cam-nang',
    title: 'Cẩm nang nghề nghiệp',
    desc: 'Kinh nghiệm phỏng vấn, lương thị trường và kỹ năng ngành công nghiệp.',
    icon: BookOpen,
    external: false,
  },
  {
    href: BRAND_RECRUITER_SITE_URL,
    title: 'Cổng Nhà tuyển dụng B2B',
    desc: 'Đăng tin tuyển dụng, tìm ứng viên AI và dịch vụ Săn nhân sự.',
    icon: Building2,
    external: true,
  },
] as const;

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#F5F8FC]">
      <PublicHeader />

      <main className="mx-auto flex w-full max-w-[1040px] flex-1 flex-col items-center justify-center px-4 py-14 sm:px-6 lg:py-20">
        <div className="w-full overflow-hidden rounded-3xl border border-[#DCE6F4] bg-white p-7 text-center shadow-[0_20px_50px_-24px_rgba(7,35,72,0.18)] sm:p-12">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-800">
            <Compass className="h-3.5 w-3.5 text-[#E8872A]" />
            <span>404 · Không tìm thấy trang</span>
          </div>

          <p
            aria-hidden="true"
            className="mt-4 select-none bg-gradient-to-r from-[#072348] via-[#0B468C] to-[#E8872A] bg-clip-text text-6xl font-black tracking-tight text-transparent sm:text-7xl"
          >
            404
          </p>

          <h1 className="mx-auto mt-3 max-w-2xl text-2xl font-extrabold tracking-tight text-[#072348] sm:text-3xl">
            Trang bạn tìm không tồn tại hoặc tin tuyển dụng đã ngừng tuyển
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-[15px]">
            Đường dẫn có thể đã thay đổi, bị nhập sai hoặc vị trí tuyển dụng này đã đóng hồ sơ. Bạn
            có thể quay lại trang chủ hoặc khám phá các việc làm công nghiệp mới nhất bên dưới.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/viec-lam"
              className="inline-flex items-center gap-2 rounded-xl bg-[#E8872A] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#d6761b]"
            >
              <Briefcase className="h-4 w-4" />
              <span>Xem việc làm đang tuyển</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-[#072348]/20 bg-white px-5 py-3 text-sm font-semibold text-[#072348] transition hover:border-[#072348]/40 hover:bg-slate-50"
            >
              <Home className="h-4 w-4" />
              <span>Về trang chủ inLink</span>
            </Link>
          </div>
        </div>

        <section aria-label="Lối tắt hữu ích" className="mt-8 w-full">
          <p className="mb-3.5 text-center text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            Khám phá nhanh trên inLink
          </p>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {QUICK_LINKS.map((item) => {
              const Icon = item.icon;
              const cardClass =
                'group flex flex-col rounded-2xl border border-[#DCE6F4] bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-[#E8872A]/60 hover:shadow-md';
              const inner = (
                <>
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#072348]/5 text-[#072348] transition group-hover:bg-[#E8872A] group-hover:text-white">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="mt-3 text-sm font-bold text-[#072348] group-hover:text-[#0B468C]">
                    {item.title}
                  </span>
                  <span className="mt-1 text-xs leading-relaxed text-slate-500">{item.desc}</span>
                </>
              );

              if (item.external) {
                return (
                  <a
                    key={item.title}
                    href={item.href}
                    className={cardClass}
                  >
                    {inner}
                  </a>
                );
              }
              return (
                <Link key={item.title} href={item.href} className={cardClass}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
