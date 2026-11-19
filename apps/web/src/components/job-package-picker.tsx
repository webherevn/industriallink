'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Briefcase, Package } from 'lucide-react';
import { fetchRecruiterJobPackages } from '@/lib/recruiter-billing';

/**
 * Chọn gói tin đăng dùng cho tin này.
 *
 * Mỗi gói đang chạy (ACTIVE) cấp lượt đăng cho 1 tin riêng — 2 gói không thể
 * dùng chung 1 tin. Bỏ trống = hệ thống tự chọn gói ACTIVE còn lượt
 * (gói hết hạn sớm nhất).
 */
export function JobPackagePicker({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (code: string | null) => void;
  disabled?: boolean;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['recruiter-job-packages'],
    queryFn: fetchRecruiterJobPackages,
    retry: false,
  });

  const items = data?.items ?? [];
  const usable = items.filter((pkg) => pkg.status === 'active' && pkg.canPostJob);
  const activeCount = items.filter((pkg) => pkg.status === 'active').length;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-500">
        Đang tải gói tin đăng…
      </div>
    );
  }

  if (usable.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-600">
        <span className="font-semibold text-slate-800">
          {activeCount > 0
            ? 'Các gói tin đăng đang chạy đã dùng hết lượt đăng.'
            : 'Chưa có gói tin đăng đang chạy.'}
        </span>{' '}
        {activeCount > 0
          ? 'Hãy mua thêm gói hoặc kích hoạt gói đang chờ để đăng tin tiếp.'
          : 'Mua gói Tin đăng rồi bấm "Sử dụng gói này" để đăng tin.'}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Package className="h-3.5 w-3.5" />
        </span>
        <p className="text-[13.5px] font-bold text-[#072348]">Gói tin đăng dùng cho tin này</p>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
        Mỗi gói chỉ dùng được cho 1 tin. Chọn gói cụ thể hoặc để hệ thống tự chọn gói hết hạn sớm nhất.
      </p>

      <div className="mt-3 space-y-2">
        <PackageOption
          selected={value == null}
          disabled={disabled}
          title="Tự động chọn gói"
          subtitle={`${usable.length} gói đang chạy`}
          onSelect={() => onChange(null)}
        />
        {usable.map((pkg) => (
          <PackageOption
            key={pkg.code}
            selected={value === pkg.code}
            disabled={disabled}
            title={pkg.planName}
            subtitle={`${pkg.code} · còn ${pkg.jobsRemaining ?? '∞'} lượt đăng${
              pkg.displayDays ? ` · hiển thị ${pkg.displayDays} ngày` : ''
            }`}
            onSelect={() => onChange(pkg.code)}
          />
        ))}
      </div>
    </div>
  );
}

function PackageOption({
  selected,
  disabled,
  title,
  subtitle,
  onSelect,
}: {
  selected: boolean;
  disabled?: boolean;
  title: string;
  subtitle: string;
  onSelect: () => void;
}) {
  return (
    <label
      className={clsx(
        'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition',
        selected
          ? 'border-brand-300 bg-brand-50/60'
          : 'border-slate-200 bg-white hover:border-slate-300',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        type="radio"
        name="jobPackageCode"
        checked={selected}
        disabled={disabled}
        onChange={onSelect}
        className="mt-0.5 h-4 w-4 accent-[#E8872A]"
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#072348]">
          <Briefcase className="h-3.5 w-3.5 text-slate-400" />
          {title}
        </span>
        <span className="mt-0.5 block text-[11.5px] text-slate-500">{subtitle}</span>
      </span>
    </label>
  );
}
