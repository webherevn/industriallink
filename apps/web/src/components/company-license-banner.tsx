'use client';

import { useQuery } from '@tanstack/react-query';
import { Clock3, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { getMyCompanyVerification } from '@/lib/company';

export function useCompanyLicenseGate() {
  const query = useQuery({
    queryKey: ['my-company-verification'],
    queryFn: getMyCompanyVerification,
    retry: false,
    staleTime: 30_000,
  });
  const data = query.data;
  const isVerified = Boolean(data?.verified || data?.status === 'approved');
  const hasLicenseDoc = Boolean(data?.hasLicenseDoc);
  const canSubmitPublish = !data || isVerified || hasLicenseDoc;
  return { ...query, isVerified, hasLicenseDoc, canSubmitPublish };
}

/**
 * Thông báo trạng thái Giấy phép ĐKKD khi NTD tạo / đăng tin tuyển dụng:
 * - Chưa tải ĐKKD: cho phép soạn & lưu nháp, nhắc tải ĐKKD để đăng công khai.
 * - Đã tải ĐKKD, đang chờ duyệt: cho phép gửi đăng, tin sẽ ở trạng thái Chờ duyệt.
 * - Đã xác minh: không hiển thị.
 */
export function CompanyLicenseBanner() {
  const { data, isVerified, hasLicenseDoc } = useCompanyLicenseGate();
  if (!data || isVerified) return null;

  if (!hasLicenseDoc) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-xs text-amber-900">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 leading-relaxed">
            <p className="font-bold text-amber-950">
              Cần tải Giấy phép ĐKKD để đăng tin công khai
            </p>
            <p className="mt-0.5 text-amber-800">
              Bạn vẫn có thể dùng AI viết JD và <strong>Lưu nháp</strong> ngay bây giờ. Để gửi
              đăng tin công khai, vui lòng tải Giấy phép ĐKKD tại mục Xác minh doanh nghiệp.
            </p>
          </div>
        </div>
        <Link
          href="/company?tab=verification"
          className="inline-flex shrink-0 items-center rounded-xl bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-amber-700"
        >
          Tải ĐKKD ngay →
        </Link>
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-sky-200 bg-sky-50/90 px-4 py-3 text-xs text-sky-900">
      <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
      <p className="leading-relaxed">
        <strong>Giấy phép ĐKKD đang chờ xác minh:</strong> Bạn có thể bấm đăng tin ngay — tin sẽ
        vào hàng <strong>Chờ duyệt</strong> và hiển thị công khai ngay khi SuperAdmin duyệt ĐKKD
        cùng tin tuyển dụng.
      </p>
    </div>
  );
}
