'use client';

import clsx from 'clsx';
import { JobTrack, JOB_TRACK_LABEL } from '@industriallink/contracts';

/** Segment Kinh doanh / Kỹ thuật trên form đăng tin. */
export function JobTrackToggle({
  value,
  onChange,
  className,
}: {
  value: JobTrack;
  onChange: (track: JobTrack) => void;
  className?: string;
}) {
  const options: JobTrack[] = [JobTrack.Sales, JobTrack.Technical];

  return (
    <div className={className}>
      <p className="mb-2 text-xs font-semibold text-slate-700">Lĩnh vực tin tuyển dụng</p>
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
        Kinh doanh dùng ma trận 22 trường JD matching. Kỹ thuật giữ form hiện tại — sẽ cập nhật sau.
      </p>
    </div>
  );
}
