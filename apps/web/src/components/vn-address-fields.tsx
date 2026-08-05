'use client';

import { VN_PROVINCES_2025 } from '@industriallink/contracts';

type Props = {
  ward: string;
  province: string;
  onChange: (patch: { ward?: string; province?: string }) => void;
  /** Bắt buộc chọn tỉnh (mặc định không — trường trống được phép). */
  requireProvince?: boolean;
  className?: string;
};

/**
 * Địa chỉ theo cải cách 01/7/2025: chỉ Xã/Phường/Đặc khu + Tỉnh/Thành.
 * Không còn trường huyện trên form.
 */
export function VnAddressFields({
  ward,
  province,
  onChange,
  requireProvince = false,
  className,
}: Props) {
  return (
    <div className={className ?? 'grid gap-3 sm:grid-cols-2'}>
      <label className="block">
        <span className="text-xs font-semibold text-slate-600">Xã / Phường / Đặc khu</span>
        <input
          value={ward}
          onChange={(e) => onChange({ ward: e.target.value })}
          placeholder="VD: Phường Cầu Giấy… (có thể bỏ trống)"
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
        />
      </label>
      <label className="block">
        <span className="text-xs font-semibold text-slate-600">
          Tỉnh / Thành phố{requireProvince ? ' *' : ''}
        </span>
        <select
          value={province}
          onChange={(e) => onChange({ province: e.target.value })}
          required={requireProvince}
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
        >
          <option value="">— Chọn tỉnh/thành (34 đơn vị mới) —</option>
          {VN_PROVINCES_2025.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {province && !(VN_PROVINCES_2025 as readonly string[]).includes(province) ? (
          <p className="mt-1 text-[11px] text-amber-700">
            Giá trị cũ: “{province}”. Nên chọn lại theo danh mục 34 tỉnh/thành mới.
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-slate-400">
            Theo đơn vị hành chính từ 01/7/2025 — không còn cấp huyện.
          </p>
        )}
      </label>
    </div>
  );
}
