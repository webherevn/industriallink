'use client';

import { UserRound } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ApplicationStatus, type ApplicantView, formatJobTitle } from '@industriallink/contracts';
import { Badge } from '@/components/ui';
import { APPLICATION_STATUS_LABEL, PIPELINE_STEPS, statusTone } from '@/lib/format';

/** Các cột hiển thị trên bảng: các bước pipeline + cột Từ chối. */
const BOARD_COLUMNS: ApplicationStatus[] = [...PIPELINE_STEPS, ApplicationStatus.Rejected];

export function KanbanBoard({
  applicants,
  onMove,
  onSchedule,
  onOffer,
  onOnboard,
}: {
  applicants: ApplicantView[];
  onMove: (applicationId: string, status: ApplicationStatus) => void;
  onSchedule?: (applicationId: string, displayName: string) => void;
  onOffer?: (applicationId: string, displayName: string) => void;
  onOnboard?: (applicationId: string, displayName: string) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<ApplicationStatus | null>(null);

  function handleDrop(target: ApplicationStatus) {
    const card = applicants.find((a) => a.applicationId === draggingId);
    setOverColumn(null);
    setDraggingId(null);
    if (card && card.status !== target) {
      onMove(card.applicationId, target);
    }
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {BOARD_COLUMNS.map((status) => {
        const cards = applicants.filter((a) => a.status === status);
        const isOver = overColumn === status;
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              if (overColumn !== status) setOverColumn(status);
            }}
            onDragLeave={() => setOverColumn((cur) => (cur === status ? null : cur))}
            onDrop={() => handleDrop(status)}
            className={
              'flex w-72 shrink-0 flex-col rounded-xl border p-3 transition ' +
              (isOver
                ? 'border-brand-400 bg-brand-50/60'
                : 'border-slate-200 bg-slate-50')
            }
          >
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-sm font-semibold text-slate-700">
                {APPLICATION_STATUS_LABEL[status]}
              </span>
              <Badge tone={statusTone(status)}>{cards.length}</Badge>
            </div>

            <div className="flex min-h-24 flex-col gap-2">
              {cards.map((a) => (
                <article
                  key={a.applicationId}
                  draggable
                  onDragStart={() => setDraggingId(a.applicationId)}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setOverColumn(null);
                  }}
                  className={
                    'cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition active:cursor-grabbing ' +
                    (draggingId === a.applicationId ? 'opacity-50 ring-2 ring-brand-300' : 'hover:shadow-md')
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{a.displayName}</p>
                    {a.matchScore != null && (
                      <span className="shrink-0 text-xs font-semibold text-brand-600">
                        {a.matchScore}%
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {a.currentPosition
                      ? formatJobTitle(a.currentPosition)
                      : 'Chưa rõ vị trí'}
                  </p>
                  {a.matchedSkills.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {a.matchedSkills.slice(0, 4).map((s) => (
                        <Badge key={s} tone="green">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-slate-100 pt-2">
                    <Link
                      href={`/candidates/${a.candidateId}`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-800 hover:text-brand-700"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <UserRound className="h-3 w-3" />
                      Xem hồ sơ
                    </Link>
                    {onSchedule &&
                      (a.status === ApplicationStatus.Screening ||
                        a.status === ApplicationStatus.Interview ||
                        a.status === ApplicationStatus.Applied) && (
                        <button
                          type="button"
                          className="text-[11px] font-semibold text-brand-600 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSchedule(a.applicationId, a.displayName);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          Đặt lịch PV
                        </button>
                      )}
                    {onOffer &&
                      (a.status === ApplicationStatus.Interview ||
                        a.status === ApplicationStatus.Offer ||
                        a.status === ApplicationStatus.Screening) && (
                        <button
                          type="button"
                          className="text-[11px] font-semibold text-teal-700 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOffer(a.applicationId, a.displayName);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          Gửi đề nghị
                        </button>
                      )}
                    {onOnboard &&
                      (a.status === ApplicationStatus.Offer ||
                        a.status === ApplicationStatus.Hired) && (
                        <button
                          type="button"
                          className="text-[11px] font-semibold text-indigo-700 hover:underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOnboard(a.applicationId, a.displayName);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          Nhận việc
                        </button>
                      )}
                  </div>
                </article>
              ))}

              {cards.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
                  Kéo thẻ vào đây
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
