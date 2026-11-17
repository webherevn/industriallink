'use client';

import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Coins,
  ExternalLink,
  Link2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { goToCtvApp } from '@/lib/hosts';

export function PartnerIntroView() {
  return (
    <div className="space-y-5">
      {/* Banner giới thiệu */}
      <section className="brand-hero-surface relative overflow-hidden rounded-2xl p-6 text-white shadow-sm sm:p-8">
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-300 ring-1 ring-white/20">
            <Sparkles className="h-3.5 w-3.5" />
            Chương trình Cộng tác viên Inlink
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Giới thiệu doanh nghiệp tuyển dụng — Nhận hoa hồng minh bạch
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-white/80">
            Bất kỳ thành viên nào trên Inlink đều có thể đăng ký làm Cộng tác viên tại cổng riêng{' '}
            <strong className="text-white">ctv.inlink.vn</strong>. Sở hữu mã giới thiệu riêng, khóa
            Mã số thuế (MST) khách hàng và theo dõi hoa hồng theo thời gian thực.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => goToCtvApp('/ctv')}
              className="inline-flex items-center gap-2 rounded-full bg-[#E8872A] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#d6761b] active:scale-95"
            >
              <span>Đăng ký / Truy cập cổng CTV</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <span className="inline-flex items-center gap-1.5 text-xs text-white/75">
              <ExternalLink className="h-3.5 w-3.5" />
              Chuyển tới ctv.inlink.vn (giữ nguyên phiên đăng nhập)
            </span>
          </div>
        </div>
      </section>

      {/* 3 lợi ích & chính sách chính */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-[#0B468C]">
            <Link2 className="h-5 w-5" />
          </span>
          <h2 className="mt-3 text-base font-bold text-[#072348]">1. Mã &amp; Link giới thiệu riêng</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            Mỗi tài khoản được cấp 1 mã CTV và đường link giới thiệu duy nhất. Doanh nghiệp đăng ký
            qua link và thanh toán gói dịch vụ trong 14 ngày sẽ tự động ghi nhận hoa hồng cho bạn.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-[#E8872A]">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <h2 className="mt-3 text-base font-bold text-[#072348]">2. Khóa MST bảo vệ khách hàng</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            CTV chủ động khai báo và khóa Mã số thuế (MST) doanh nghiệp đang tiếp cận để đảm bảo
            quyền lợi độc quyền nguồn khách trong thời gian chăm sóc.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Coins className="h-5 w-5" />
          </span>
          <h2 className="mt-3 text-base font-bold text-[#072348]">3. Đối soát &amp; Chi trả định kỳ</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            Hoa hồng được tổng hợp minh bạch theo từng đơn hàng thành công trên hệ thống và thanh
            toán định kỳ hàng tháng trực tiếp qua cổng CTV.
          </p>
        </div>
      </div>

      {/* Chính sách chi tiết */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs sm:p-6">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[#0B468C]" />
          <h2 className="text-[15px] font-bold text-[#072348]">
            Chính sách &amp; Quy định Cộng tác viên
          </h2>
        </div>

        <ul className="mt-3.5 space-y-2.5 text-xs leading-relaxed text-slate-600 sm:text-sm">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              <strong>Đối tượng tham gia:</strong> Mọi người dùng có tài khoản trên Inlink (Ứng viên,
              Nhà tuyển dụng hoặc tài khoản đăng ký trực tiếp tại <strong>ctv.inlink.vn</strong>).
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              <strong>Ghi nhận hoa hồng:</strong> Áp dụng khi doanh nghiệp được giới thiệu hoàn tất
              thanh toán gói Tin đăng hoặc gói Săn nhân sự theo kỳ hạn quy định.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              <strong>Quản lý tập trung:</strong> Toàn bộ thao tác đăng ký mã CTV, lấy link giới
              thiệu, khóa MST và theo dõi ví hoa hồng được thực hiện tại cổng riêng{' '}
              <strong>ctv.inlink.vn</strong>.
            </span>
          </li>
        </ul>

        <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => goToCtvApp('/ctv')}
            className="inline-flex items-center gap-2 rounded-xl bg-[#072348] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#0c3266]"
          >
            <span>Mở cổng Cộng tác viên (ctv.inlink.vn)</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
}
