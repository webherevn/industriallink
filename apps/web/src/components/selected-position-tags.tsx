'use client';

import clsx from 'clsx';

/**
 * Vùng tag các vị trí ứng tuyển đã chọn — dùng CHUNG cho cả 2 nhánh.
 *
 * Mục 13 chỉ nên chọn trong danh mục chuẩn của nhánh đang active. Vùng tag này
 * đảm bảo mọi giá trị đã chọn đều nhìn thấy và gỡ bỏ được (nút `×`) — không bao
 * giờ phát sinh dữ liệu ẩn không gỡ được.
 */
export function SelectedPositionTags({
  selected,
  onRemove,
  emptyHint,
}: {
  selected: string[];
  onRemove: (value: string) => void;
  /** Gợi ý khi chưa chọn vị trí nào. */
  emptyHint?: string;
}) {
  if (selected.length === 0) {
    if (!emptyHint) return null;
    return (
      <p className="text-[11px] text-slate-500">{emptyHint}</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {selected.map((value) => (
        <span
          key={value}
          className={clsx(
            'inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1',
            'text-xs font-semibold text-brand-800 ring-1 ring-brand-100',
          )}
        >
          {value}
          <button
            type="button"
            onClick={() => onRemove(value)}
            className="text-brand-400 hover:text-brand-700"
            aria-label={`Xoá ${value}`}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
