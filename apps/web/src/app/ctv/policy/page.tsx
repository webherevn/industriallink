'use client';

import clsx from 'clsx';
import {
  CalendarClock,
  CheckCircle2,
  Cookie,
  Percent,
  ScrollText,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';

type PolicyItem = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  lead: string;
  points: string[];
  tone: string;
};

const POLICIES: PolicyItem[] = [
  {
    id: 'cookie',
    icon: Cookie,
    title: 'Cơ chế Cookie 14 ngày',
    lead:
      'Khi khách hàng mở link giới thiệu của bạn, hệ thống ghi nhận mã CTV trong 14 ngày kể từ lần bấm đầu tiên.',
    points: [
      'Trong 14 ngày, khách đăng ký tài khoản và thanh toán gói — hoa hồng về tài khoản của bạn.',
      'Khách bấm lại link (kể cả link của CTV khác) trong 14 ngày thì mã của bạn vẫn được giữ.',
      'Ngoài 14 ngày, mã CTV của người bấm mới được tính.',
      'Cookie gắn với trình duyệt của khách. Khách xóa cookie hoặc đăng ký từ thiết bị khác thì không ghi nhận.',
    ],
    tone: 'bg-blue-50 text-blue-700',
  },
  {
    id: 'tax-lock',
    icon: ScrollText,
    title: 'Cơ chế Khóa MST 30 ngày & tối đa 30 mã',
    lead:
      'Khóa Mã số thuế giúp bạn giữ quyền hoa hồng với doanh nghiệp mà bạn giới thiệu.',
    points: [
      'Mỗi mã số thuế thuộc về một cộng tác viên — không có chuyện hai người cùng giữ một MST.',
      'Mỗi CTV khóa tối đa 30 mã số thuế đang hiệu lực.',
      'Mỗi mã giữ 30 ngày kể từ lúc khóa. Hết hạn thì mã tự nhả và bạn có thể khóa mã mới.',
      'Khóa MST không gán gói, không tính hoa hồng ngay — hoa hồng chỉ ghi khi doanh nghiệp đó thanh toán gói.',
    ],
    tone: 'bg-violet-50 text-violet-700',
  },
  {
    id: 'plans',
    icon: CheckCircle2,
    title: 'Gói dịch vụ nào tính hoa hồng',
    lead: 'Hoa hồng chỉ ghi trên các đơn gói có giá lớn hơn 0.',
    points: [
      'Tính hoa hồng: Gói Tin đăng, Gói Tin đăng Plus, Gói Săn nhân sự, Gói Săn chuyên sâu và các gói có giá.',
      'Không tính hoa hồng: Gói Khám phá (0đ) và nạp lẻ Credit.',
      'Tỷ lệ hoa hồng là tỷ lệ tại thời điểm khách hàng thanh toán, hiển thị rõ ở từng dòng lịch sử.',
    ],
    tone: 'bg-emerald-50 text-emerald-700',
  },
  {
    id: 'kyc',
    icon: ShieldCheck,
    title: 'Xác thực CCCD 2 mặt & điều kiện nhận tiền',
    lead:
      'Để nhận hoa hồng qua chuyển khoản ngân hàng, bạn cần hoàn tất xác thực CCCD 2 mặt và khai báo tài khoản ngân hàng.',
    points: [
      'Cần ảnh mặt trước và mặt sau CCCD, chụp rõ 4 góc, không lóa, không che số.',
      'Số CCCD đúng 12 chữ số. Tên chủ tài khoản ngân hàng phải khớp với họ tên trên CCCD.',
      'Ảnh CCCD lưu trong kho riêng tư — chỉ bạn và kế toán CRM có quyền xem, không chia sẻ công khai.',
      'CRM Admin duyệt hồ sơ. Nếu hồ sơ đã xác thực mà bạn sửa thông tin, hồ sơ chuyển về Chờ duyệt lại và kỳ chi trả đang chờ sẽ tạm giữ.',
    ],
    tone: 'bg-amber-50 text-amber-700',
  },
  {
    id: 'payout',
    icon: Percent,
    title: 'Khấu trừ thuế TNCN 10% & lịch chi trả ngày 10',
    lead:
      'Khi khoản chi trả trong một kỳ từ 2.000.000đ trở lên và bạn là cá nhân, Inlink khấu trừ thuế TNCN 10% theo quy định.',
    points: [
      'Khoản chi dưới 2.000.000đ trong kỳ: không khấu trừ thuế.',
      'Khoản chi từ 2.000.000đ trở lên trong kỳ: khấu trừ 10%. Số thực nhận = tổng hoa hồng kỳ − thuế.',
      'Số dư tự động cộng khi khách hàng thanh toán gói và đối soát chuyển khoản ngân hàng vào ngày 10 hàng tháng.',
      'Mã giao dịch / UNC của kỳ chi trả hiển thị ở màn "Ví & Kỳ chi trả" để bạn đối soát.',
    ],
    tone: 'bg-rose-50 text-rose-700',
  },
];

export default function CtvPolicyPage() {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-base font-bold tracking-tight text-[#0F2440]">
          Chính sách & Hướng dẫn cộng tác viên
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          Tóm tắt đầy đủ cách Inlink ghi nhận hoa hồng, bảo vệ quyền giới thiệu và chi trả cho bạn.
          Nếu có điểm chưa rõ, hãy liên hệ đội ngũ kinh doanh Inlink.
        </p>
      </section>

      {POLICIES.map((policy) => {
        const Icon = policy.icon;
        return (
          <section
            key={policy.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <span
                className={clsx(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                  policy.tone,
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#0F2440]">{policy.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{policy.lead}</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2.5">
              {policy.points.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <XCircle className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#0F2440]">Những gì KHÔNG tính hoa hồng</h3>
            <ul className="mt-3 space-y-2.5">
              {[
                'Gói Khám phá 0đ — khách không trả tiền nên không sinh hoa hồng.',
                'Nạp lẻ Credit — thanh toán riêng, không gắn vào gói dịch vụ có hoa hồng.',
                'Khóa Mã số thuế — chỉ giữ quyền giới thiệu, không gán gói, không tính tiền.',
                'Đơn chưa thanh toán — hoa hồng chỉ ghi khi khách trả đủ.',
                'Đơn bị hủy hoặc hoàn tiền — dòng hoa hồng tương ứng bị loại khỏi kỳ chi trả.',
              ].map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-700"
                >
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <CalendarClock className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#0F2440]">Sẵn sàng nhận hoa hồng?</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Xác thực CCCD & tài khoản ngân hàng để mở cổng chi trả ngày 10 hàng tháng.
            </p>
          </div>
        </div>
        <Link
          href="/ctv/kyc"
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#0F2440] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#16324f]"
        >
          Xác thực CCCD & Ngân hàng
        </Link>
      </section>
    </div>
  );
}
