'use client';

import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { desiredPositionOptionsForTrack } from '@industriallink/contracts';
import type { CvDraft } from '@/lib/cv-templates';

type Props = {
  draft: CvDraft;
  onChange: <K extends keyof CvDraft>(key: K, value: CvDraft[K]) => void;
  titleHint?: { status?: string };
};

/**
 * Vị trí ứng tuyển + vị trí mong muốn — chỉ hiện sau khi đã chọn lĩnh vực KD/KT,
 * options lấy từ danh sách nền tảng theo track.
 */
export function CvApplyPositionFields({ draft, onChange, titleHint }: Props) {
  const track = draft.jobTrack;
  const options = useMemo(() => desiredPositionOptionsForTrack(track), [track]);
  const titleInList = Boolean(draft.title && options.includes(draft.title));
  const [forceCustom, setForceCustom] = useState(false);

  useEffect(() => {
    if (titleInList) setForceCustom(false);
  }, [track, titleInList]);

  if (!track) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-500">
        Chọn <span className="font-semibold text-slate-700">Kinh doanh</span> hoặc{' '}
        <span className="font-semibold text-slate-700">Kỹ thuật</span> ở trên để hiện danh sách vị
        trí ứng tuyển phù hợp.
      </p>
    );
  }

  const showCustom = forceCustom || (Boolean(draft.title) && !titleInList);
  const selectValue = showCustom ? '__custom__' : draft.title;

  return (
    <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:p-4">
      <div>
        <label className="block">
          <span className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            Vị trí ứng tuyển
            {titleHint?.status === 'filled' ? (
              <span className="text-[10px] font-medium text-emerald-600">OK</span>
            ) : titleHint?.status === 'missing' ? (
              <span className="text-[10px] font-medium text-amber-600">Thiếu</span>
            ) : null}
          </span>
          <select
            value={selectValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '__custom__') {
                setForceCustom(true);
                if (titleInList) onChange('title', '');
                return;
              }
              setForceCustom(false);
              onChange('title', v);
              if (v && !draft.desiredPositions.includes(v)) {
                onChange('desiredPositions', [v, ...draft.desiredPositions].slice(0, 3));
              }
            }}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
          >
            <option value="">— Chọn vị trí theo lĩnh vực —</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
            <option value="__custom__">Khác (tự nhập)</option>
          </select>
        </label>
        {showCustom && (
          <input
            value={draft.title}
            onChange={(e) => onChange('title', e.target.value)}
            placeholder="Nhập vị trí ứng tuyển…"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-brand-500/30 focus:ring-2"
          />
        )}
        <p className="mt-1 text-[11px] text-slate-400">
          Danh sách theo lĩnh vực {track === 'technical' ? 'Kỹ thuật' : 'Kinh doanh'} (tiêu chí hồ
          sơ + lộ trình cấp bậc + taxonomy ngành).
        </p>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-slate-700">
          Vị trí mong muốn (tối đa 3)
        </p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {options.map((opt) => {
            const checked = draft.desiredPositions.includes(opt);
            const atMax = draft.desiredPositions.length >= 3 && !checked;
            return (
              <label
                key={opt}
                className={clsx(
                  'flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition',
                  checked
                    ? 'border-brand-300 bg-brand-50 text-brand-900'
                    : atMax
                      ? 'cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300',
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={checked}
                  disabled={atMax}
                  onChange={() => {
                    if (checked) {
                      onChange(
                        'desiredPositions',
                        draft.desiredPositions.filter((p) => p !== opt),
                      );
                    } else if (!atMax) {
                      onChange('desiredPositions', [...draft.desiredPositions, opt].slice(0, 3));
                    }
                  }}
                />
                <span>{opt}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
