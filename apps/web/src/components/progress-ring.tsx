'use client';

import clsx from 'clsx';
import { Check } from 'lucide-react';
import type { CvDraftFieldHint } from '@industriallink/contracts';

export function ProgressRing({ percent }: { percent: number }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const safe = Math.max(0, Math.min(100, percent));
  const offset = c - (safe / 100) * c;
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="44"
          cy="44"
          r={r}
          fill="none"
          stroke="#1e46e0"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-brand-700">{safe}%</span>
      </div>
    </div>
  );
}

/** Card tiến độ kiểu tạo JD — chỉ hiển thị %, không thay form. */
export function CriteriaCompletionCard({
  title,
  percent,
  filledCount,
  totalCount,
  gaps,
  maxGaps = 5,
}: {
  title: string;
  percent: number;
  filledCount: number;
  totalCount: number;
  gaps: CvDraftFieldHint[];
  maxGaps?: number;
}) {
  const shown = gaps.slice(0, maxGaps);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-3 flex items-center gap-4">
        <ProgressRing percent={percent} />
        <div className="min-w-0 flex-1 space-y-2 text-sm">
          <p className="text-slate-600">
            <span className="font-semibold text-slate-800">{filledCount}</span>
            <span className="text-slate-400"> / {totalCount}</span> tiêu chí đã đủ
          </p>
          {shown.length > 0 ? (
            <ul className="space-y-1.5">
              {shown.map((f) => (
                <li key={f.key} className="flex items-start gap-2">
                  <span
                    className={clsx(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]',
                      'bg-slate-100 text-slate-400',
                    )}
                  >
                    ·
                  </span>
                  <span className="text-slate-500 line-clamp-2">{f.label}</span>
                </li>
              ))}
              {gaps.length > maxGaps && (
                <li className="text-xs text-slate-400">+{gaps.length - maxGaps} mục khác</li>
              )}
            </ul>
          ) : (
            <p className="flex items-center gap-1.5 text-emerald-700">
              <Check className="h-4 w-4" />
              Đã đủ tiêu chí theo lĩnh vực
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
