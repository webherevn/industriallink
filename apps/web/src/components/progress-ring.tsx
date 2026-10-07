'use client';

import clsx from 'clsx';
import { Check, Circle, Sparkles } from 'lucide-react';
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
  const safe = Math.max(0, Math.min(100, percent));
  const remaining = Math.max(0, totalCount - filledCount);
  const done = filledCount >= totalCount;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-200/70 bg-gradient-to-br from-white via-white to-brand-50/60 p-4 shadow-[0_4px_18px_-6px_rgba(30,70,224,0.18)] ring-1 ring-brand-100/60">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-brand-100/40 blur-2xl"
      />
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 ring-1 ring-brand-200/70">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
        </div>
        {done ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
            <Check className="h-3 w-3" />
            Xong
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700 ring-1 ring-brand-200">
            Còn {remaining}
          </span>
        )}
      </div>
      <div className="relative mt-3 flex items-center gap-4">
        <ProgressRing percent={percent} />
        <div className="min-w-0 flex-1 space-y-2 text-sm">
          <p className="text-slate-600">
            <span className="text-base font-extrabold text-slate-900">{filledCount}</span>
            <span className="text-slate-400"> / {totalCount}</span>
            <span className="ml-1 text-slate-500">tiêu chí đã đủ</span>
            <span className="ml-2 text-xs font-semibold text-brand-600">· {safe}%</span>
          </p>
          {shown.length > 0 ? (
            <ul className="space-y-1.5">
              {shown.map((f) => (
                <li key={f.key} className="flex items-start gap-2">
                  <span
                    className={clsx(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                      'bg-rose-50 text-rose-500 ring-1 ring-rose-200/80',
                    )}
                  >
                    <Circle className="h-2.5 w-2.5 fill-current" />
                  </span>
                  <span className="text-[13px] font-medium text-slate-700 line-clamp-1">
                    {f.label}
                  </span>
                </li>
              ))}
              {gaps.length > maxGaps && (
                <li className="text-xs font-medium text-slate-400 pl-7">
                  +{gaps.length - maxGaps} mục khác
                </li>
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
