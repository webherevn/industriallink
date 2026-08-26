'use client';

import clsx from 'clsx';
import { useMemo, useState } from 'react';
import {
  DESIRED_POSITION_QUESTION,
  TECHNICAL_POSITION_QUESTION,
  desiredPositionOptionsForTrack,
} from '@industriallink/contracts';
import type { CvDraft } from '@/lib/cv-templates';

type Props = {
  draft: CvDraft;
  onChange: <K extends keyof CvDraft>(key: K, value: CvDraft[K]) => void;
  titleHint?: { status?: string };
};

/**
 * STT 13. Vị trí ứng tuyển — Kinh doanh: danh sách 5 vị trí.
 * Kỹ thuật: chọn tối đa 3 + "Khác" tự nhập (ma trận 32 mục).
 */
export function CvApplyPositionFields({ draft, onChange, titleHint }: Props) {
  const track = draft.jobTrack;
  const options = useMemo(() => desiredPositionOptionsForTrack(track), [track]);
  const [otherText, setOtherText] = useState('');
  const isTechnical = track === 'technical';
  const max = isTechnical ? 3 : undefined;

  if (!track) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-500">
        Chọn <span className="font-semibold text-slate-700">Kinh doanh</span> hoặc{' '}
        <span className="font-semibold text-slate-700">Kỹ thuật</span> ở trên để hiện danh sách vị
        trí ứng tuyển phù hợp.
      </p>
    );
  }

  const catalogSet = new Set(options);
  const customSelected = draft.desiredPositions.filter((p) => !catalogSet.has(p));

  function setPositions(next: string[]) {
    const clipped = max != null ? next.slice(0, max) : next;
    onChange('desiredPositions', clipped);
    onChange('title', clipped[0] ?? '');
  }

  function addOther() {
    const value = otherText.trim();
    if (!value) return;
    if (draft.desiredPositions.some((p) => p.toLowerCase() === value.toLowerCase())) {
      setOtherText('');
      return;
    }
    if (max != null && draft.desiredPositions.length >= max) return;
    setPositions([...draft.desiredPositions, value]);
    setOtherText('');
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          13. Vị trí ứng tuyển
          {titleHint?.status === 'filled' ? (
            <span className="text-[10px] font-medium text-emerald-600">OK</span>
          ) : titleHint?.status === 'missing' ? (
            <span className="text-[10px] font-medium text-amber-600">Thiếu</span>
          ) : null}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {isTechnical ? TECHNICAL_POSITION_QUESTION : DESIRED_POSITION_QUESTION}
        </p>
        {isTechnical && (
          <p className="mt-1 text-[11px] text-amber-700">
            {`Tối đa 3 (${draft.desiredPositions.length}/3)`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((opt) => {
          const checked = draft.desiredPositions.includes(opt);
          const atMax = max != null && draft.desiredPositions.length >= max && !checked;
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
                    setPositions(draft.desiredPositions.filter((p) => p !== opt));
                  } else if (!atMax) {
                    setPositions([...draft.desiredPositions, opt]);
                  }
                }}
              />
              <span>{opt}</span>
            </label>
          );
        })}
      </div>

      {isTechnical && (
        <div className="space-y-2">
          {customSelected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {customSelected.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800"
                >
                  {v}
                  <button
                    type="button"
                    onClick={() => setPositions(draft.desiredPositions.filter((p) => p !== v))}
                    className="font-bold text-brand-500 hover:text-brand-700"
                    aria-label={`Xoá ${v}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
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
              disabled={
                !otherText.trim() ||
                (max != null && draft.desiredPositions.length >= max)
              }
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
