'use client';

import clsx from 'clsx';
import { useMemo, useState } from 'react';
import {
  ALLOWED_POSITIONS,
  DESIRED_POSITION_QUESTION,
  MAX_DESIRED_POSITIONS,
  TECHNICAL_POSITION_QUESTION,
  filterDesiredPositionsForTrack,
  normalizeProfileTrack,
} from '@industriallink/contracts';
import { NumberedFieldLabel } from '@/components/numbered-field-label';
import { SelectedPositionTags } from '@/components/selected-position-tags';
import { criteriaAnchorId } from '@/lib/criteria-jump';
import type { CvDraft } from '@/lib/cv-templates';

type Props = {
  draft: CvDraft;
  onChange: <K extends keyof CvDraft>(key: K, value: CvDraft[K]) => void;
  titleHint?: { status?: string };
};

/**
 * STT 13. Vị trí ứng tuyển — chuẩn hoá theo lĩnh vực đang active.
 *
 * Ranh giới nghiêm ngặt (STRICT BOUNDARY):
 * - Mỗi nhánh có danh mục vị trí CHUẨN riêng (KD 6 vị trí / KT 14 vị trí).
 * - Mọi giá trị không thuộc danh mục của nhánh đang active bị LOẠI BỎ khỏi
 *   state trước khi render → không bao giờ hiển thị "Tối đa 3 (3/3)" sai.
 * - Bộ đếm & trạng thái disabled tính trên danh sách ĐÃ LỌC, không phải state thô.
 * - Tối đa 3 vị trí — áp dụng cho CẢ 2 nhánh.
 */
export function CvApplyPositionFields({ draft, onChange, titleHint }: Props) {
  const track = draft.jobTrack;
  const [otherText, setOtherText] = useState('');
  const isTechnical = track === 'technical';
  const max = MAX_DESIRED_POSITIONS;

  // Danh mục chuẩn của nhánh đang active — KHÔNG trộn 2 nhánh.
  const options = useMemo(() => {
    if (!track) return [];
    return [...ALLOWED_POSITIONS[normalizeProfileTrack(track)]];
  }, [track]);

  /**
   * Vị trí đang chọn ĐÃ LỌC theo nhánh active — đây là nguồn sự thật cho
   * bộ đếm, trạng thái disabled và việc render checkbox.
   */
  const selectedPositions = useMemo(() => {
    if (!track) return [];
    return filterDesiredPositionsForTrack(draft.desiredPositions, normalizeProfileTrack(track));
  }, [draft.desiredPositions, track]);

  if (!track) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-500">
        Chọn <span className="font-semibold text-slate-700">Kinh doanh</span> hoặc{' '}
        <span className="font-semibold text-slate-700">Kỹ thuật</span> ở trên để hiện danh sách vị
        trí ứng tuyển phù hợp.
      </p>
    );
  }

  function setPositions(next: string[]) {
    const clipped = next.slice(0, max);
    onChange('desiredPositions', clipped);
    onChange('title', clipped[0] ?? '');
  }

  function addOther() {
    const value = otherText.trim();
    if (!value) return;
    if (selectedPositions.some((p) => p.toLowerCase() === value.toLowerCase())) {
      setOtherText('');
      return;
    }
    if (selectedPositions.length >= max) return;
    setPositions([...selectedPositions, value]);
    setOtherText('');
  }

  const atLimit = selectedPositions.length >= max;

  return (
    <div id={criteriaAnchorId('desiredPositions')} className="scroll-mt-28 space-y-3">
      <div>
        <NumberedFieldLabel
          title="13. Vị trí ứng tuyển"
          description={isTechnical ? TECHNICAL_POSITION_QUESTION : DESIRED_POSITION_QUESTION}
          extra={
            titleHint?.status === 'filled' ? (
              <span className="text-[10px] font-medium text-emerald-600">OK</span>
            ) : titleHint?.status === 'missing' ? (
              <span className="text-[10px] font-medium text-amber-600">Thiếu</span>
            ) : null
          }
          className="mb-0"
        />
        <p className="mt-1 text-[11px] text-amber-700">{`Tối đa ${max} (${selectedPositions.length}/${max})`}</p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((opt) => {
          const checked = selectedPositions.includes(opt);
          const atMax = atLimit && !checked;
          return (
            <label
              key={opt}
              className={clsx(
                'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition',
                checked
                  ? 'border-brand-300 bg-brand-50 text-brand-900'
                  : atMax
                    ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
              )}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                checked={checked}
                disabled={atMax}
                onChange={() => {
                  if (checked) {
                    setPositions(selectedPositions.filter((p) => p !== opt));
                  } else if (!atMax) {
                    setPositions([...selectedPositions, opt]);
                  }
                }}
              />
              <span>{opt}</span>
            </label>
          );
        })}
      </div>

      {/* Vùng tag đã chọn — dùng chung cho cả 2 nhánh (mọi giá trị đều gỡ bỏ được). */}
      <SelectedPositionTags
        selected={selectedPositions}
        onRemove={(value) => setPositions(selectedPositions.filter((p) => p !== value))}
        emptyHint="Chưa chọn vị trí ứng tuyển nào."
      />

      {isTechnical && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-1.5 text-sm">
            <span className="shrink-0 text-slate-600">Khác:</span>
            <input
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addOther();
                }
              }}
              placeholder="Nhập vị trí…"
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={addOther}
              disabled={!otherText.trim() || atLimit}
              className="shrink-0 rounded-md bg-brand-500 px-2 py-1 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-40"
            >
              Thêm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
