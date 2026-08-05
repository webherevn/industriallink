'use client';

import clsx from 'clsx';
import { JobTrack, JOB_TRACK_LABEL } from '@industriallink/contracts';

type Props = {
  value: 'sales' | 'technical' | null;
  onChange: (track: 'sales' | 'technical') => void;
  className?: string;
};

/** Segment chọn lĩnh vực Kinh doanh / Kỹ thuật trên form Tạo CV. */
export function CvTrackToggle({ value, onChange, className }: Props) {
  const options: Array<'sales' | 'technical'> = [JobTrack.Sales, JobTrack.Technical];

  return (
    <div className={className}>
      <p className="mb-2 text-xs font-semibold text-slate-700">
        Lĩnh vực / vị trí ứng tuyển
      </p>
      <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
        {options.map((track) => {
          const active = value === track;
          return (
            <button
              key={track}
              type="button"
              onClick={() => onChange(track)}
              className={clsx(
                'rounded-lg px-4 py-2 text-sm font-semibold transition',
                active
                  ? 'bg-white text-brand-700 shadow-sm ring-1 ring-brand-100'
                  : 'text-slate-500 hover:text-slate-800',
              )}
            >
              {JOB_TRACK_LABEL[track]}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[11px] text-slate-400">
        Chọn lĩnh vực để hiện đúng tiêu chí. Upload CV: AI sẽ tự nhận diện.
      </p>
    </div>
  );
}
