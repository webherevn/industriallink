'use client';

import clsx from 'clsx';
import {
  CalendarDays,
  FileText,
  MessageSquare,
  MoreHorizontal,
  NotebookPen,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ApplicationStatus,
  type ApplicantView,
  formatJobTitle,
} from '@industriallink/contracts';
import { Badge } from '@/components/ui';
import {
  APPLICATION_SOURCE_LABEL,
  APPLICATION_STATUS_LABEL,
  interviewMarkText,
  PIPELINE_STEPS,
  relativeTime,
  statusTone,
  toTitleCase,
} from '@/lib/format';
import { formatMatchPct, matchBadgeTone } from '@/lib/match-percent';

/** Cột đang được kéo thẻ vào — dùng để đổi bước khi thả. */
type DropTarget = ApplicationStatus | null;

/**
 * Bảng Kanban 5 cột quy trình hoạt động — chia đều `grid-cols-5` vừa khít 100%
 * chiều rộng màn hình desktop (không cắt cột, không cuộn ngang).
 * Cột "Đã từ chối" được tách sang tab riêng ở trang cha (xem `jobs/[id]/applicants`).
 */
export function KanbanBoard({
  applicants,
  onMove,
  onSchedule,
  onOffer,
  onOnboard,
  onReject,
  onNote,
  onMessage,
  highlightCandidateId,
}: {
  applicants: ApplicantView[];
  onMove: (applicationId: string, status: ApplicationStatus) => void;
  onSchedule?: (applicationId: string, displayName: string) => void;
  onOffer?: (applicationId: string, displayName: string) => void;
  onOnboard?: (applicationId: string, displayName: string) => void;
  /** Chuyển ứng viên sang "Đã từ chối" kèm lý do. */
  onReject?: (applicationId: string, displayName: string) => void;
  /** Ghi chú nội bộ. */
  onNote?: (applicationId: string, displayName: string) => void;
  /** Nhắn tin ứng viên. */
  onMessage?: (applicationId: string, displayName: string) => void;
  /** Ứng viên cần highlight (đến từ Hộp thư qua `?highlightCandidateId=`). */
  highlightCandidateId?: string | null;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<DropTarget>(null);

  function handleDrop(target: ApplicationStatus) {
    const card = applicants.find((a) => a.applicationId === draggingId);
    setOverColumn(null);
    setDraggingId(null);
    if (!card || card.status === target) return;
    if (target === ApplicationStatus.Interview) {
      onSchedule?.(card.applicationId, card.displayName);
      return;
    }
    if (target === ApplicationStatus.Hired) {
      onOnboard?.(card.applicationId, card.displayName);
      return;
    }
    onMove(card.applicationId, target);
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5 xl:gap-4">
      {PIPELINE_STEPS.map((status) => {
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
            className={clsx(
              'flex min-w-0 flex-col rounded-xl border p-2.5 transition xl:p-3',
              isOver
                ? 'border-brand-400 bg-brand-50/60'
                : 'border-slate-200 bg-slate-50',
            )}
          >
            <div className="mb-2.5 flex items-center justify-between px-1">
              <span className="truncate text-[13px] font-semibold text-slate-700">
                {APPLICATION_STATUS_LABEL[status]}
              </span>
              <Badge tone={statusTone(status)}>{cards.length}</Badge>
            </div>
            {status === ApplicationStatus.Interview && (
              <p className="mb-2 px-1 text-[11px] leading-snug text-slate-500">
                Kéo thẻ vào đây để đặt lịch phỏng vấn (HR hoặc Chuyên môn)
              </p>
            )}

            <div className="flex min-h-24 flex-col gap-2">
              {cards.map((a) => (
                <KanbanCard
                  key={a.applicationId}
                  applicant={a}
                  dragging={draggingId === a.applicationId}
                  highlighted={highlightCandidateId === a.candidateId}
                  onDragStart={() => setDraggingId(a.applicationId)}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setOverColumn(null);
                  }}
                  onMove={(next) => onMove(a.applicationId, next)}
                  onSchedule={
                    onSchedule
                      ? () => onSchedule(a.applicationId, a.displayName)
                      : undefined
                  }
                  onOffer={
                    onOffer ? () => onOffer(a.applicationId, a.displayName) : undefined
                  }
                  onOnboard={
                    onOnboard ? () => onOnboard(a.applicationId, a.displayName) : undefined
                  }
                  onReject={
                    onReject ? () => onReject(a.applicationId, a.displayName) : undefined
                  }
                  onNote={
                    onNote ? () => onNote(a.applicationId, a.displayName) : undefined
                  }
                  onMessage={
                    onMessage ? () => onMessage(a.applicationId, a.displayName) : undefined
                  }
                />
              ))}

              {cards.length === 0 && (
                <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
                  {status === ApplicationStatus.Interview
                    ? 'Kéo thẻ vào đây để đặt lịch phỏng vấn'
                    : 'Kéo thẻ vào đây'}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Nút hành động đúng với từng bước trong quy trình. */
function stageActions(
  status: ApplicationStatus,
  handlers: {
    onSchedule?: () => void;
    onOffer?: () => void;
    onOnboard?: () => void;
    onMove?: (next: ApplicationStatus) => void;
  },
): { label: string; onClick: () => void; className: string }[] {
  switch (status) {
    case ApplicationStatus.Applied:
      return [
        {
          label: 'Sàng lọc',
          onClick: () => handlers.onMove?.(ApplicationStatus.Screening),
          className: 'text-brand-600 hover:underline',
        },
      ];
    case ApplicationStatus.Screening:
      return [
        {
          label: 'Đặt lịch PV',
          onClick: () => handlers.onSchedule?.(),
          className: 'text-sky-700 hover:underline',
        },
      ];
    case ApplicationStatus.Interview:
      return [
        {
          label: 'Gửi đề nghị',
          onClick: () => handlers.onOffer?.(),
          className: 'text-teal-700 hover:underline',
        },
      ];
    case ApplicationStatus.Offer:
      return [
        {
          label: 'Nhận việc',
          onClick: () => handlers.onOnboard?.(),
          className: 'text-indigo-700 hover:underline',
        },
      ];
    case ApplicationStatus.Hired:
      return [];
    default:
      return [];
  }
}

function KanbanCard({
  applicant: a,
  dragging,
  highlighted,
  onDragStart,
  onDragEnd,
  onMove,
  onSchedule,
  onOffer,
  onOnboard,
  onReject,
  onNote,
  onMessage,
}: {
  applicant: ApplicantView;
  dragging: boolean;
  highlighted: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onMove: (next: ApplicationStatus) => void;
  onSchedule?: () => void;
  onOffer?: () => void;
  onOnboard?: () => void;
  onReject?: () => void;
  onNote?: () => void;
  onMessage?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Hiệu ứng highlight viền sáng 3 giây khi khớp `highlightCandidateId`.
  const [flash, setFlash] = useState(highlighted);
  useEffect(() => {
    if (!highlighted) return;
    setFlash(true);
    const id = window.setTimeout(() => setFlash(false), 3000);
    return () => window.clearTimeout(id);
  }, [highlighted]);

  useEffect(() => {
    if (!menuOpen) return;
    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [menuOpen]);

  const actions = useMemo(
    () =>
      stageActions(a.status, {
        onSchedule,
        onOffer,
        onOnboard,
        onMove,
      }),
    [a.status, onSchedule, onOffer, onOnboard, onMove],
  );

  const source = a.source ?? 'self_applied';
  const timeLabel = relativeTime(a.createdAt);

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={clsx(
        'group cursor-grab rounded-lg border bg-white p-2.5 shadow-sm transition active:cursor-grabbing',
        dragging ? 'opacity-50 ring-2 ring-brand-300' : 'hover:shadow-md',
        flash
          ? 'border-amber-400 ring-2 ring-amber-300 animate-[pulse_1.2s_ease-in-out_3]'
          : 'border-slate-200',
      )}
    >
      <div className="flex items-start justify-between gap-1.5">
        <p className="truncate text-[13px] font-semibold text-slate-900">
          {toTitleCase(a.displayName)}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          {a.matchScore != null && (
            <span
              className={clsx(
                'rounded px-1.5 py-0.5 text-[10.5px] font-semibold ring-1',
                matchBadgeTone(a.matchScore),
              )}
            >
              {formatMatchPct(a.matchScore)}%
            </span>
          )}
          <div ref={menuRef} className="relative">
            <button
              type="button"
              aria-label="Thao tác ứng viên"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 focus:opacity-100 group-hover:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-6 z-30 w-48 rounded-xl border border-slate-200 bg-white py-1.5 text-left shadow-lg">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onMessage?.();
                  }}
                  className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Nhắn tin
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onNote?.();
                  }}
                  className="flex w-full items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <NotebookPen className="h-3.5 w-3.5" />
                  Ghi chú nội bộ
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onReject?.();
                  }}
                  className="block w-full px-3 py-2 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  Từ chối ứng viên
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dòng phụ: chức danh hiện tại — ưu tiên `primaryTitle` (đã đồng bộ theo lĩnh vực active) */}
      <p className="mt-0.5 truncate text-[11.5px] text-slate-500">
        {(() => {
          const title = a.primaryTitle ?? a.currentPosition;
          return title ? formatJobTitle(title) : 'Chưa rõ vị trí';
        })()}
      </p>

      {/* Badge nguồn hồ sơ + thời gian nộp/cập nhật */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
          {APPLICATION_SOURCE_LABEL[source]}
        </span>
        {/* ⭐ Tag ứng tuyển CHÉO lĩnh vực — NTD thấy nhanh nhóm kỹ sư ứng tuyển JD KD. */}
        {a.crossTrack && (
          <span
            className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 ring-1 ring-inset ring-violet-200"
            title="Ứng viên ứng tuyển chéo lĩnh vực"
          >
            Chéo lĩnh vực · {a.candidateTrack === 'technical' ? 'Kỹ thuật' : 'Kinh doanh'}
          </span>
        )}
        {timeLabel && (
          <span className="text-[10px] font-medium text-slate-400">{timeLabel}</span>
        )}
      </div>

      {a.interviews.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {a.interviews.map((mark, index) => (
            <li
              key={`${mark.type}-${mark.scheduledAt}-${index}`}
              className="text-[10.5px] font-medium text-violet-800"
            >
              {interviewMarkText(mark)}
            </li>
          ))}
        </ul>
      )}
      {a.status === ApplicationStatus.Interview && a.interviews.length === 0 && (
        <p className="mt-1.5 text-[10.5px] font-medium text-amber-700">
          Chưa đặt lịch HR hay chuyên môn
        </p>
      )}
      {a.matchedSkills.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {a.matchedSkills.slice(0, 3).map((s) => (
            <Badge key={s} tone="green">
              {s}
            </Badge>
          ))}
        </div>
      )}

      {/* Hành động theo bước — KHÔNG hiện nút của bước đang đứng */}
      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-slate-100 pt-2">
        <Link
          href={`/candidates/${a.candidateId}${a.matchScore != null ? `?match=${formatMatchPct(a.matchScore)}` : ''}`}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-800 transition hover:text-brand-700"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <UserRound className="h-3 w-3" />
          Xem hồ sơ
        </Link>
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            className={clsx('text-[11px] font-semibold transition', action.className)}
            onClick={(e) => {
              e.stopPropagation();
              action.onClick();
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {action.label}
          </button>
        ))}
        {a.status === ApplicationStatus.Offer && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 transition hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onOffer?.();
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <FileText className="h-3 w-3" />
            Xem đề nghị
          </button>
        )}
        {a.status === ApplicationStatus.Interview && (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 transition hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onSchedule?.();
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <CalendarDays className="h-3 w-3" />
            Đặt lịch PV
          </button>
        )}
      </div>
    </article>
  );
}
