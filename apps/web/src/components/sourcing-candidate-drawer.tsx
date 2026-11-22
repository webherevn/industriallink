'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { AlertCircle, Bookmark, BookmarkCheck, Briefcase, Calendar, CheckCircle2, ChevronDown, ExternalLink, Headphones, HelpCircle, Loader2, Lock, Mail, MapPin, MessageCircle, Phone, Sparkles, UserPlus, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ConnectionStatus, InterviewType, SOURCING_OUTREACH_STATUS_META, formatJobLevel, formatJobTitle, type CandidateMatchView, type RecruiterHuntCampaignResourceView, type RecruiterSourcingEntitlements, type RecruiterSourcingOutreachItem, type RecruiterSourcingWorkspace, type SourcingOutreachStatus } from '@industriallink/contracts';
import { handleCreditError, useCreditAlert } from '@/components/credit-alert-provider';
import { SafeHtml, looksLikeHtml } from '@/components/render-safe-html';
import { Button, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { addCandidateShortlist, getCandidateById, openConnectionChat, removeCandidateShortlist, requestCandidateConnection } from '@/lib/candidate';
import { formatVndAmount } from '@/lib/format';
import { scheduleInterview } from '@/lib/interviews';
import { formatMatchPct } from '@/lib/match-percent';
import { consumeRecruiterSourcing } from '@/lib/recruiter-billing';

function potentialCreditCost(score: number): 1 | 2 {
  const pct = Math.max(0, Math.min(100, score));
  return pct >= 80 ? 2 : 1;
}
// ============================================================================
// 3. SLIDE-OVER DRAWER XỬ LÝ ỨNG VIÊN ALL-IN-ONE NGAY TRÊN TRANG SĂN NHÂN SỰ
// ============================================================================

export type SourcingDrawerSection = 'overview' | 'jd_match' | 'contact' | 'interview' | 'unlock';

export function SourcingCandidateDrawer({
  candidateRow,
  initialSection = 'overview',
  onClose,
  campaignId,
  campaignTitle,
  jobId,
  entitlements,
  /** Tài nguyên RIÊNG của chiến dịch (campaign-level) — nguồn sự thật cho quyền lợi. */
  resource,
  isShortlisted,
  outreachItem,
  onShortlistSuccess,
  onOutreachSuccess,
  onProfileUnlocked,
}: {
  candidateRow: CandidateMatchView | null;
  initialSection?: SourcingDrawerSection;
  onClose: () => void;
  campaignId: string | null;
  campaignTitle: string;
  jobId: string | null;
  entitlements: RecruiterSourcingEntitlements;
  /** Tài nguyên riêng của chiến dịch (đọc từ đúng 1 BillingHuntPackage). */
  resource?: RecruiterHuntCampaignResourceView | null;
  isShortlisted: boolean;
  outreachItem?: RecruiterSourcingOutreachItem | null;
  onShortlistSuccess: (ws: RecruiterSourcingWorkspace, candidateName: string, removed?: boolean) => void;
  onOutreachSuccess?: (ws: RecruiterSourcingWorkspace, candidateName: string) => void;
  onProfileUnlocked: () => void;
}) {
  const qc = useQueryClient();
  const { showAlert: showCreditAlert } = useCreditAlert();
  const jdMatchRef = useRef<HTMLDivElement | null>(null);
  const contactRef = useRef<HTMLDivElement | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [connectMessage, setConnectMessage] = useState('');
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [showOutreachForm, setShowOutreachForm] = useState(false);
  const [outreachNote, setOutreachNote] = useState('');
  const [interviewAt, setInterviewAt] = useState('');
  const [interviewType, setInterviewType] = useState<InterviewType>(InterviewType.Hr);
  const [interviewMode, setInterviewMode] = useState<'online' | 'onsite'>('online');
  const [interviewLocation, setInterviewLocation] = useState('');
  const [interviewNote, setInterviewNote] = useState('');
  const [expandedExp, setExpandedExp] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  // Tầng 3 — bảng đối chiếu chi tiết (mặc định thu gọn).
  // Hook phải nằm ở top-level component, KHÔNG được gọi trong render callback.
  const [showDetailTable, setShowDetailTable] = useState(false);

  /**
   * Quyền bàn giao Inlink: 100% theo CHIẾN DỊCH (gói gắn qua huntPackageId).
   * Chỉ gói Chuyên sâu (DEEP) mới có; KHÔNG đọc cờ cấp Company/User.
   */
  const hasOutreach = resource?.canHandover === true;
  const outreachQuota = resource?.totalHandovers ?? 0;
  const outreachRemaining = resource?.handoversRemaining ?? 0;
  const isOutreached = Boolean(outreachItem);

  useEffect(() => {
    const isOpen = Boolean(candidateRow);
    window.dispatchEvent(new CustomEvent('inlink-candidate-drawer', { detail: { open: isOpen } }));
    return () => {
      window.dispatchEvent(new CustomEvent('inlink-candidate-drawer', { detail: { open: false } }));
    };
  }, [candidateRow]);

  useEffect(() => {
    if (!candidateRow) return;
    setUnlocked(Boolean(candidateRow.viewed || candidateRow.applied || outreachItem));
    setConnectMessage(
      `Chào ${candidateRow.displayName}, công ty chúng tôi đang tuyển vị trí «${campaignTitle}» rất phù hợp với kinh nghiệm của bạn trên inlink. Mong được kết nối trao đổi thêm cùng bạn!`,
    );
    setOutreachNote(
      `Nhờ CSKH Inlink liên hệ ứng viên ${candidateRow.displayName} cho vị trí «${campaignTitle}», thẩm định nhu cầu chuyển việc & mức lương kỳ vọng giúp doanh nghiệp.`,
    );
    setShowInterviewForm(initialSection === 'interview');
    setShowOutreachForm(false);
    setExpandedExp(false);
    setFeedback(null);

    const timer = window.setTimeout(() => {
      if (initialSection === 'jd_match') {
        jdMatchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (initialSection === 'contact' || initialSection === 'unlock') {
        contactRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
    return () => window.clearTimeout(timer);
  }, [candidateRow, campaignTitle, initialSection, outreachItem]);

  const pctStr = candidateRow ? formatMatchPct(candidateRow.match.score) : '0';
  const creditCost = candidateRow ? potentialCreditCost(candidateRow.match.score) : 1;

  const {
    data: detail,
    isLoading: loadingDetail,
    refetch: fetchDetail,
  } = useQuery({
    queryKey: ['sourcing-candidate-drawer', candidateRow?.candidateId, unlocked],
    queryFn: async () => {
      const res = await getCandidateById(candidateRow!.candidateId, 'sourcing', pctStr, campaignId);
      onProfileUnlocked();
      return res;
    },
    enabled: Boolean(candidateRow?.candidateId && unlocked),
    retry: false,
  });

  const unlockMutation = useMutation({
    mutationFn: async () => {
      if (!candidateRow) throw new Error('Chưa chọn ứng viên');
      return getCandidateById(candidateRow.candidateId, 'sourcing', pctStr, campaignId);
    },
    onSuccess: (data) => {
      setUnlocked(true);
      qc.setQueryData(['sourcing-candidate-drawer', candidateRow?.candidateId, true], data);
      onProfileUnlocked();
      setFeedback({
        tone: 'ok',
        text: 'Đã mở khóa toàn bộ thông tin hồ sơ & liên hệ ứng viên!',
      });
    },
    onError: (err) => {
      handleCreditError(err, showCreditAlert);
      setFeedback({
        tone: 'err',
        text: err instanceof ApiError ? err.message : 'Không mở được hồ sơ ứng viên',
      });
    },
  });

  const shortlistMutation = useMutation({
    mutationFn: async () => {
      if (!candidateRow || !campaignId) throw new Error('Chưa chọn vị trí Săn');
      if (isShortlisted) {
        await removeCandidateShortlist(candidateRow.candidateId).catch(() => null);
        const ws = await consumeRecruiterSourcing({
          kind: 'shortlist',
          campaignId,
          jobId: jobId ?? undefined,
          note: `unshortlist:${candidateRow.candidateId}:${candidateRow.displayName}`,
        });
        return { ws, removed: true };
      }
      await addCandidateShortlist(candidateRow.candidateId).catch(() => null);
      const ws = await consumeRecruiterSourcing({
        kind: 'shortlist',
        campaignId,
        jobId: jobId ?? undefined,
        note: `shortlist:${candidateRow.candidateId}:${candidateRow.displayName}`,
      });
      return { ws, removed: false };
    },
    onSuccess: ({ ws, removed }) => {
      if (candidateRow) {
        onShortlistSuccess(ws, candidateRow.displayName, removed);
      }
      setFeedback({
        tone: 'ok',
        text: removed
          ? `Đã bỏ «${candidateRow?.displayName}» khỏi danh sách Shortlist.`
          : `Đã đưa «${candidateRow?.displayName}» vào danh sách Shortlist!`,
      });
    },
    onError: (err) => {
      setFeedback({
        tone: 'err',
        text: err instanceof ApiError ? err.message : 'Không cập nhật được Shortlist',
      });
    },
  });

  const outreachMutation = useMutation({
    mutationFn: async () => {
      if (!candidateRow || !campaignId) throw new Error('Chưa chọn vị trí Săn');
      const cleanName = candidateRow.displayName.replace(/:/g, ' ');
      const cleanNote = outreachNote.trim().replace(/:/g, ' -');
      const ws = await consumeRecruiterSourcing({
        kind: 'shortlist',
        campaignId,
        jobId: jobId ?? undefined,
        note: `outreach:${candidateRow.candidateId}:${cleanName}:${cleanNote}`,
      });
      const detailRes = await getCandidateById(
        candidateRow.candidateId,
        'sourcing',
        pctStr,
        campaignId,
      ).catch(() => null);
      return { ws, detailRes };
    },
    onSuccess: ({ ws, detailRes }) => {
      setUnlocked(true);
      setShowOutreachForm(false);
      if (detailRes && candidateRow) {
        qc.setQueryData(['sourcing-candidate-drawer', candidateRow.candidateId, true], detailRes);
      }
      onProfileUnlocked();
      if (candidateRow) {
        onOutreachSuccess?.(ws, candidateRow.displayName);
      }
      setFeedback({
        tone: 'ok',
        text: `Đã bàn giao «${candidateRow?.displayName}» cho đội ngũ CSKH Inlink liên hệ kết nối & tự động mở khóa toàn bộ hồ sơ!`,
      });
    },
    onError: (err) => {
      setFeedback({
        tone: 'err',
        text: err instanceof ApiError ? err.message : 'Không giao được ứng viên cho Inlink liên hệ',
      });
    },
  });

  const outreachStatusMutation = useMutation({
    mutationFn: async (status: SourcingOutreachStatus) => {
      if (!candidateRow || !campaignId) throw new Error('Chưa chọn vị trí Săn');
      return consumeRecruiterSourcing({
        kind: 'shortlist',
        campaignId,
        jobId: jobId ?? undefined,
        note: `outreach_status:${candidateRow.candidateId}:${status}`,
      });
    },
    onSuccess: (ws, status) => {
      void qc.setQueryData(['recruiter-sourcing'], ws);
      const meta = SOURCING_OUTREACH_STATUS_META[status];
      setFeedback({
        tone: 'ok',
        text: `Đã cập nhật trạng thái hỗ trợ chuyên sâu: «${meta.label}» (${meta.description})`,
      });
    },
    onError: (err) => {
      setFeedback({
        tone: 'err',
        text: err instanceof ApiError ? err.message : 'Không cập nhật được trạng thái tiếp cận',
      });
    },
  });

  const connectMutation = useMutation({
    mutationFn: () => {
      if (!candidateRow) throw new Error('Chưa chọn ứng viên');
      return requestCandidateConnection(candidateRow.candidateId, connectMessage.trim() || undefined);
    },
    onSuccess: () => {
      void fetchDetail();
      void qc.invalidateQueries({ queryKey: ['recruiter-billing-entitlements'] });
      setFeedback({
        tone: 'ok',
        text: 'Đã gửi yêu cầu kết nối / mời ứng tuyển tới ứng viên!',
      });
    },
    onError: (err) => {
      handleCreditError(err, showCreditAlert);
      setFeedback({
        tone: 'err',
        text: err instanceof ApiError ? err.message : 'Không gửi được yêu cầu kết nối',
      });
    },
  });

  const interviewMutation = useMutation({
    mutationFn: () => {
      if (!candidateRow) throw new Error('Chưa chọn ứng viên');
      if (!interviewAt) throw new Error('Vui lòng chọn ngày giờ phỏng vấn');
      return scheduleInterview({
        candidateId: candidateRow.candidateId,
        jobId: jobId ?? undefined,
        scheduledAt: new Date(interviewAt).toISOString(),
        durationMinutes: 45,
        type: interviewType,
        ...(interviewMode === 'online'
          ? { meetingLink: interviewLocation.trim() || undefined }
          : { location: interviewLocation.trim() || undefined }),
        notes: interviewNote.trim() || undefined,
      });
    },
    onSuccess: () => {
      setShowInterviewForm(false);
      setFeedback({
        tone: 'ok',
        text: 'Đã tạo lịch phỏng vấn thành công và gửi thông báo cho ứng viên!',
      });
    },
    onError: (err) => {
      setFeedback({
        tone: 'err',
        text: err instanceof ApiError ? err.message : 'Không đặt được lịch phỏng vấn',
      });
    },
  });

  if (!candidateRow) return null;

  const clampedPct = Math.max(0, Math.min(100, candidateRow.match.score));
  const ringRadius = 26;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - clampedPct / 100);
  const ringStroke = clampedPct >= 80 ? '#34d399' : clampedPct >= 65 ? '#fbbf24' : '#fb923c';
  const connectionStatus = detail?.connection?.status ?? null;
  const connectionId = detail?.connection?.id ?? null;

  const experiences = detail?.experiences ?? [];
  const EXPERIENCE_WORD_LIMIT = 140;
  let totalExpWords = 0;
  for (const exp of experiences) {
    const text = `${exp.jobTitle ?? ''} ${exp.companyName ?? ''} ${exp.highlights ?? ''}`.trim();
    totalExpWords += text ? text.split(/\s+/).length : 0;
  }
  const shouldTruncateExp = totalExpWords > EXPERIENCE_WORD_LIMIT;
  let remainingWords = EXPERIENCE_WORD_LIMIT;
  const visibleExperiences = expandedExp || !shouldTruncateExp
    ? experiences.map((exp) => ({ ...exp, truncatedHighlights: exp.highlights }))
    : experiences.reduce<Array<(typeof experiences)[number] & { truncatedHighlights: string | null }>>((acc, exp) => {
        if (remainingWords <= 0) return acc;
        const headerWords = `${exp.jobTitle ?? ''} ${exp.companyName ?? ''}`.trim().split(/\s+/).filter(Boolean).length;
        remainingWords = Math.max(0, remainingWords - headerWords);
        if (!exp.highlights) {
          acc.push({ ...exp, truncatedHighlights: null });
          return acc;
        }
        const words = exp.highlights.trim().split(/\s+/);
        if (words.length <= remainingWords) {
          remainingWords -= words.length;
          acc.push({ ...exp, truncatedHighlights: exp.highlights });
        } else if (remainingWords > 0) {
          const sliced = `${words.slice(0, remainingWords).join(' ')}...`;
          remainingWords = 0;
          acc.push({ ...exp, truncatedHighlights: sliced });
        }
        return acc;
      }, []);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs">
      <div className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
        {/* Header cố định */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-[#072348] px-5 py-4 text-white sm:px-6">
          <div className="flex items-center gap-4">
            {/* Vòng tròn tỉ lệ % thiết kế chuẩn SVG Gauge */}
            <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#041730]/80 shadow-[0_0_20px_rgba(232,135,42,0.22)] ring-1 ring-white/15">
              <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden>
                <circle
                  cx="32"
                  cy="32"
                  r={ringRadius}
                  fill="none"
                  stroke="rgba(255,255,255,0.14)"
                  strokeWidth="4.5"
                />
                <circle
                  cx="32"
                  cy="32"
                  r={ringRadius}
                  fill="none"
                  stroke={ringStroke}
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  strokeDashoffset={ringOffset}
                  className="transition-[stroke-dashoffset] duration-500 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[13px] font-black leading-none tracking-tight text-amber-300">
                  {pctStr}
                  <span className="text-[10px] font-extrabold">%</span>
                </span>
                <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-white/80">
                  Phù hợp
                </span>
              </div>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-white">{candidateRow.displayName}</h3>
                {candidateRow.applied ? (
                  <span className="rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-200 ring-1 ring-emerald-300/40">
                    Đã nộp đơn
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-200 ring-1 ring-amber-300/40">
                    Ứng viên inlink săn
                  </span>
                )}
                {isShortlisted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-400/25 px-2.5 py-0.5 text-[10px] font-bold text-indigo-100 ring-1 ring-indigo-300/40">
                    <BookmarkCheck className="h-3 w-3" />
                    Đã Shortlist
                  </span>
                ) : null}
                {isOutreached ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/25 px-2.5 py-0.5 text-[10px] font-bold text-emerald-100 ring-1 ring-emerald-300/50">
                    <Headphones className="h-3 w-3" />
                    Inlink đang liên hệ
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-white/80">
                {candidateRow.currentPosition
                  ? formatJobTitle(candidateRow.currentPosition)
                  : 'Chưa cập nhật vị trí'}
                {candidateRow.location ? ` · ${candidateRow.location}` : ''}
                {candidateRow.industry ? ` · ${candidateRow.industry}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Thanh công cụ All-in-One cố định ngay dưới Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-[#f8fafc] px-5 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            {hasOutreach ? (
              isOutreached ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-2xs">
                  <Headphones className="h-3.5 w-3.5 text-emerald-600" />
                  Đã giao Inlink liên hệ · Đội CSKH đang tiếp cận
                </span>
              ) : (
                <button
                  type="button"
                  disabled={outreachMutation.isPending || (outreachRemaining != null && outreachRemaining <= 0)}
                  onClick={() => {
                    setShowInterviewForm(false);
                    setShowOutreachForm((v) => !v);
                  }}
                  className={clsx(
                    'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45',
                    showOutreachForm
                      ? 'bg-[#072348] text-white ring-2 ring-[#E8872A]/60'
                      : 'bg-gradient-to-r from-[#072348] to-[#0f3b74] text-white hover:from-[#0a2f5e] hover:to-[#134688]',
                  )}
                >
                  <Headphones className="h-3.5 w-3.5 text-amber-300" />
                  <span>Giao Inlink liên hệ</span>
                  <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-200">
                    Còn {outreachRemaining ?? 0}/{outreachQuota}
                  </span>
                </button>
              )
            ) : null}

            <button
              type="button"
              onClick={() => {
                setShowOutreachForm(false);
                setShowInterviewForm((v) => !v);
              }}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold shadow-sm transition active:scale-[0.99]',
                showInterviewForm
                  ? 'bg-[#072348] text-white ring-2 ring-[#E8872A]/50'
                  : 'bg-[#E8872A] text-white shadow-[#E8872A]/25 hover:bg-[#d6761b]',
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              {showInterviewForm ? 'Đang mở lịch phỏng vấn' : 'Đặt lịch phỏng vấn'}
            </button>

            <button
              type="button"
              disabled={
                shortlistMutation.isPending ||
                (!isShortlisted &&
                  entitlements.shortlistsRemaining != null &&
                  entitlements.shortlistsRemaining <= 0)
              }
              onClick={() => shortlistMutation.mutate()}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition active:scale-[0.99] disabled:opacity-45',
                isShortlisted
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
              )}
              title={isShortlisted ? 'Đang trong Shortlist · Bấm để bỏ Shortlist' : 'Đưa ứng viên vào Shortlist'}
            >
              {isShortlisted ? (
                <BookmarkCheck className="h-3.5 w-3.5 text-indigo-600" />
              ) : (
                <Bookmark className="h-3.5 w-3.5 text-slate-400" />
              )}
              <span>{isShortlisted ? 'Đã Shortlist' : 'Shortlist'}</span>
            </button>
          </div>

          <Link
            href={`/candidates/${candidateRow.candidateId}?from=sourcing&match=${pctStr}`}
            target="_blank"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#072348]"
          >
            Trang đầy đủ
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {/* Nội dung cuộn */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
          {feedback ? (
            <div
              className={clsx(
                'flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-xs font-medium',
                feedback.tone === 'ok'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800',
              )}
            >
              {feedback.tone === 'ok' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              {feedback.text}
            </div>
          ) : null}

          {/* Trạng thái ứng viên đã bàn giao cho đội ngũ CSKH Inlink */}
          {isOutreached && outreachItem ? (
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-white p-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
                  <Headphones className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wide text-emerald-950">
                      Tiến độ hỗ trợ chuyên sâu Inlink
                    </h4>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                      Đã bàn giao lúc{' '}
                      {new Intl.DateTimeFormat('vi-VN', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      }).format(new Date(outreachItem.createdAt))}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Trạng thái hiện tại:{' '}
                    <strong className="text-[#072348]">
                      {SOURCING_OUTREACH_STATUS_META[outreachItem.status ?? 'pending_contact'].label}
                    </strong>{' '}
                    — {SOURCING_OUTREACH_STATUS_META[outreachItem.status ?? 'pending_contact'].description}.
                  </p>
                  {outreachItem.note ? (
                    <p className="mt-1.5 rounded-xl bg-white/80 px-3 py-1.5 text-[11px] text-slate-700 ring-1 ring-emerald-200/70">
                      <strong className="text-[#072348]">Ghi chú bàn giao CSKH:</strong> {outreachItem.note}
                    </p>
                  ) : null}

                  <div className="mt-3 border-t border-emerald-200/60 pt-2.5">
                    <p className="text-[11px] font-bold text-[#072348]">
                      Cập nhật trạng thái tiếp cận & chuyển đổi ứng viên:
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(Object.keys(SOURCING_OUTREACH_STATUS_META) as SourcingOutreachStatus[]).map((st) => {
                        const meta = SOURCING_OUTREACH_STATUS_META[st];
                        const active = (outreachItem.status ?? 'pending_contact') === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            disabled={outreachStatusMutation.isPending}
                            onClick={() => outreachStatusMutation.mutate(st)}
                            title={meta.description}
                            className={clsx(
                              'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-50',
                              active
                                ? 'bg-[#072348] text-white shadow-2xs'
                                : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:border-[#072348] hover:text-[#072348]',
                            )}
                          >
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Form xác nhận Giao Inlink liên hệ */}
          {showOutreachForm && !isOutreached ? (
            <div className="rounded-2xl border-2 border-[#072348]/20 bg-gradient-to-br from-[#f4f8fd] to-white p-4 space-y-3 shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#072348] text-amber-300">
                    <Headphones className="h-4 w-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wide text-[#072348]">
                      Giao đội ngũ CSKH Inlink liên hệ & mở khóa ứng viên
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Sử dụng 1 lượt trong hạn mức{' '}
                      <strong className="text-[#E8872A]">
                        {outreachRemaining ?? 0}/{outreachQuota} ứng viên tiềm năng
                      </strong>{' '}
                      của gói Tin săn Chuyên sâu (tự động mở khóa toàn bộ hồ sơ & liên hệ).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOutreachForm(false)}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  Đóng
                </button>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700">
                  Lời nhắn / Yêu cầu thẩm định gửi đội ngũ CSKH Inlink (mức lương, thời gian đi làm, câu hỏi sàng lọc...)
                </label>
                <textarea
                  rows={2}
                  value={outreachNote}
                  onChange={(e) => setOutreachNote(e.target.value)}
                  placeholder="Nhập yêu cầu cụ thể để CSKH Inlink trao đổi khi gọi cho ứng viên..."
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-[#072348]"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-slate-500">
                  ✓ Tự động mở khóa SĐT & Email · ✓ CSKH Inlink gọi thẩm định & kết nối trực tiếp
                </span>
                <Button
                  disabled={outreachMutation.isPending}
                  onClick={() => outreachMutation.mutate()}
                >
                  {outreachMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Headphones className="h-4 w-4" />
                  )}
                  Xác nhận giao Inlink liên hệ (-1 lượt)
                </Button>
              </div>
            </div>
          ) : null}

          {/* Form đặt lịch phỏng vấn nhanh tại chỗ — PAYWALL: chỉ mở khi đã mở khóa hồ sơ */}
          {showInterviewForm ? (
            !unlocked ? (
              <div className="rounded-2xl border-2 border-[#E8872A]/40 bg-gradient-to-br from-amber-50/90 to-white p-4">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E8872A] text-white">
                    <Lock className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-extrabold uppercase tracking-wide text-[#072348]">
                      Cần mở khóa hồ sơ trước khi đặt lịch phỏng vấn
                    </h4>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                      Ứng viên tiềm năng chưa mở khóa hồ sơ. Hãy dùng Credit mở khóa hồ sơ trước
                      (nút «Mở khóa &amp; Liên hệ» bên dưới), sau đó quay lại đặt lịch phỏng vấn.
                    </p>
                    <Button
                      className="mt-3"
                      disabled={unlockMutation.isPending}
                      onClick={() => unlockMutation.mutate()}
                    >
                      {unlockMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Mở khóa hồ sơ ({creditCost} Credit)
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-[#072348]">
                  Đặt lịch phỏng vấn ngay tại chỗ
                </h4>
                <button
                  type="button"
                  onClick={() => setShowInterviewForm(false)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Đóng
                </button>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">Ngày & giờ phỏng vấn</label>
                  <input
                    type="datetime-local"
                    value={interviewAt}
                    onChange={(e) => setInterviewAt(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-[#072348]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700">Vòng & Hình thức</label>
                  <div className="mt-1 grid grid-cols-2 gap-1.5">
                    <select
                      value={interviewType}
                      onChange={(e) => setInterviewType(e.target.value as InterviewType)}
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none"
                    >
                      <option value={InterviewType.Hr}>Vòng HR</option>
                      <option value={InterviewType.Technical}>Chuyên môn</option>
                      <option value={InterviewType.Other}>Vòng cuối</option>
                    </select>
                    <select
                      value={interviewMode}
                      onChange={(e) => setInterviewMode(e.target.value as 'online' | 'onsite')}
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none"
                    >
                      <option value="online">Online</option>
                      <option value="onsite">Trực tiếp</option>
                    </select>
                  </div>
                </div>
              </div>
              <Input
                placeholder="Link Google Meet / Zoom hoặc địa chỉ phỏng vấn..."
                value={interviewLocation}
                onChange={(e) => setInterviewLocation(e.target.value)}
              />
              <Input
                placeholder="Ghi chú cho buổi phỏng vấn (tuỳ chọn)..."
                value={interviewNote}
                onChange={(e) => setInterviewNote(e.target.value)}
              />
              <div className="flex justify-end">
                <Button
                  disabled={interviewMutation.isPending || !interviewAt}
                  onClick={() => interviewMutation.mutate()}
                >
                  {interviewMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Calendar className="h-4 w-4" />
                  )}
                  Xác nhận tạo lịch phỏng vấn
                </Button>
              </div>
            </div>
            )
          ) : null}

          {/* ============================================================
              (1) ĐỐI CHIẾU MỨC ĐỘ PHÙ HỢP JD — TÁI THIẾT KẾ 3 TẦNG
              KHÔNG hiển thị trọng số (%) hay lưới progress bar.
              Tầng 1: tóm tắt 3s · Tầng 2: tín hiệu hành động · Tầng 3: bảng chi tiết
              ============================================================ */}
          {(() => {
            const jd = candidateRow.jdMatch ?? null;

            // Dữ liệu cũ (chưa có jdMatch) → fallback tối thiểu để không trắng màn.
            const overallScore = jd?.overallScore ?? Math.round(candidateRow.match.score ?? 0);
            const level = jd?.overallLevel ?? (overallScore >= 80 ? 'HIGH' : overallScore >= 60 ? 'MEDIUM' : overallScore >= 40 ? 'LOW' : 'POOR');
            const levelLabel = jd?.overallLabel ?? (
              level === 'HIGH' ? 'Rất phù hợp' : level === 'MEDIUM' ? 'Khá phù hợp' : level === 'LOW' ? 'Cân nhắc' : 'Chưa phù hợp'
            );
            const trackLabel = jd?.track === 'technical' ? 'Kỹ thuật' : jd?.track === 'sales' ? 'Kinh doanh B2B' : null;

            const scoreBadgeClass =
              level === 'HIGH'
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80'
                : level === 'MEDIUM'
                  ? 'bg-amber-50 text-[#c96a12] ring-1 ring-amber-200/80'
                  : level === 'LOW'
                    ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-200/80'
                    : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/80';

            const criteria = jd?.criteria ?? [];
            const matchedCriteria = criteria.filter((c) => c.status === 'MATCHED' || c.status === 'PARTIAL');
            const mismatchCriteria = criteria.filter((c) => c.status === 'MISMATCH');
            const missingCriteria = criteria.filter((c) => c.status === 'MISSING');

            const GROUP_META: Record<'EXPERIENCE' | 'CONDITION', { label: string; note: string | null }> = {
              EXPERIENCE: {
                label: 'Kinh nghiệm thực chiến',
                note: jd?.groupSummary.experienceNote ?? null,
              },
              CONDITION: {
                label: 'Điều kiện & kỳ vọng chung',
                note: jd?.groupSummary.conditionNote ?? null,
              },
            };

            const groupStatusLabel = (status: string | undefined): string =>
              status === 'HIGH'
                ? 'Khớp cao'
                : status === 'PARTIAL'
                  ? 'Khớp 1 phần'
                  : status === 'LOW'
                    ? 'Chưa đạt'
                    : 'Thiếu dữ liệu';

            const groupStatusClass = (status: string | undefined): string =>
              status === 'HIGH'
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80'
                : status === 'PARTIAL'
                  ? 'bg-amber-50 text-[#c96a12] ring-1 ring-amber-200/80'
                  : status === 'LOW'
                    ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/80'
                    : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/80';

            // Tầng 3 — bảng đối chiếu chi tiết (mặc định thu gọn).
            const MISSING_TAG_LIMIT = 6;
            const visibleMissing = missingCriteria.slice(0, MISSING_TAG_LIMIT);
            const hiddenMissingCount = Math.max(0, missingCriteria.length - MISSING_TAG_LIMIT);

            return (
              <div
                ref={jdMatchRef}
                className="space-y-3 rounded-2xl border border-[#d7e3f2] bg-white p-4"
              >
                {/* ---------- TẦNG 1: TÓM TẮT TỔNG QUAN (đọc trong 3 giây) ---------- */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h4 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-[#072348]">
                      <Sparkles className="h-3.5 w-3.5 text-[#E8872A]" />
                      Đối chiếu mức độ phù hợp JD
                    </h4>
                    {trackLabel ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600">
                        {trackLabel}
                      </span>
                    ) : null}
                  </div>
                  <span
                    className={clsx(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums',
                      scoreBadgeClass,
                    )}
                  >
                    Độ phù hợp {overallScore}%
                    <span className="font-semibold opacity-80">· {levelLabel}</span>
                  </span>
                </div>

                {/* Hộp tóm tắt ngắn gọn */}
                {jd?.aiSummary ? (
                  <p className="rounded-xl border border-slate-100 bg-[#F8FAFC] px-3 py-2.5 text-xs leading-relaxed text-slate-700">
                    {jd.aiSummary}
                  </p>
                ) : null}

                {/* Cảnh báo chưa đạt lọc cứng */}
                {jd && !jd.passesHardFilter ? (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50/70 px-3 py-2.5 text-xs text-amber-900">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#c96a12]" />
                    <div>
                      <p className="font-semibold">Chưa đáp ứng điều kiện bắt buộc của JD</p>
                      {jd.rejectReasons.length > 0 ? (
                        <p className="mt-0.5 text-[11.5px] text-amber-800/90">
                          {jd.rejectReasons.join(' · ')}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {/* 2 thẻ nhóm lớn — nhãn mức độ đáp ứng, KHÔNG số % rời rạc */}
                {criteria.length > 0 ? (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {(['EXPERIENCE', 'CONDITION'] as const).map((groupKey) => {
                      const meta = GROUP_META[groupKey];
                      const status = groupKey === 'EXPERIENCE' ? jd?.groupSummary.experience : jd?.groupSummary.condition;
                      const groupItems = criteria.filter((c) => c.group === groupKey);
                      if (groupItems.length === 0) return null;
                      return (
                        <div key={groupKey} className="rounded-xl border border-slate-100 bg-[#F8FAFC] px-3 py-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11.5px] font-semibold text-slate-700">{meta.label}</span>
                            <span
                              className={clsx(
                                'rounded-full px-2 py-0.5 text-[10.5px] font-bold',
                                groupStatusClass(status),
                              )}
                            >
                              {groupStatusLabel(status)}
                            </span>
                          </div>
                          {meta.note ? (
                            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                              {meta.note}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {/* ---------- TẦNG 2: 3 NHÓM TÍN HIỆU HÀNH ĐỘNG (nhóm rỗng thì tự ẩn) ---------- */}
                {matchedCriteria.length > 0 ? (
                  <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-emerald-800">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Điểm khớp nổi bật
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {matchedCriteria.map((c) => (
                        <li key={c.key} className="text-[11.5px] leading-relaxed text-slate-700">
                          <span className="font-semibold text-[#072348]">{c.label}:</span>{' '}
                          {c.candidateEvidence ?? c.jdRequirement ?? 'Đáp ứng yêu cầu JD'}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {mismatchCriteria.length > 0 ? (
                  <div className="rounded-xl border border-rose-200/70 bg-rose-50/50 px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-rose-800">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Điểm lệch cần lưu ý
                    </p>
                    <ul className="mt-1.5 space-y-1.5">
                      {mismatchCriteria.map((c) => (
                        <li key={c.key} className="text-[11.5px] leading-relaxed text-slate-700">
                          <span className="font-semibold text-[#072348]">{c.label}:</span>
                          <span className="mt-0.5 block text-slate-600">
                            <span className="font-medium text-rose-700">Ứng viên:</span>{' '}
                            {c.candidateEvidence ?? 'Chưa có dữ liệu phù hợp'}
                            {' · '}
                            <span className="font-medium text-slate-700">JD yêu cầu:</span>{' '}
                            {c.jdRequirement ?? 'Không mô tả rõ'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {missingCriteria.length > 0 ? (
                  <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#b45309]">
                      <HelpCircle className="h-3.5 w-3.5" />
                      Cần thẩm định thêm khi sàng lọc
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600">
                      Ứng viên chưa cập nhật các thông tin này — cần hỏi thêm khi trao đổi.
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {visibleMissing.map((c) => (
                        <span
                          key={c.key}
                          className="inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-[#b45309] ring-1 ring-amber-200/70"
                        >
                          {c.label}
                        </span>
                      ))}
                      {hiddenMissingCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => setShowDetailTable(true)}
                          title={missingCriteria.slice(MISSING_TAG_LIMIT).map((c) => c.label).join(', ')}
                          className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-200/80"
                        >
                          +{hiddenMissingCount} tiêu chí khác
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {/* ---------- TẦNG 3: BẢNG ĐỐI CHIẾU CHI TIẾT (mặc định thu gọn) ---------- */}
                {criteria.length > 0 ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowDetailTable((v) => !v)}
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11.5px] font-semibold text-[#072348]/80 transition hover:bg-slate-100 hover:text-[#072348]"
                    >
                      <span>{showDetailTable ? 'Ẩn bảng đối chiếu chi tiết' : 'Xem bảng đối chiếu chi tiết'}</span>
                      <ChevronDown
                        className={clsx(
                          'h-3.5 w-3.5 transition-transform duration-200',
                          showDetailTable && 'rotate-180',
                        )}
                      />
                    </button>

                    {showDetailTable ? (
                      <div className="mt-2 overflow-x-auto rounded-xl border border-slate-100">
                        <table className="w-full min-w-[520px] border-collapse text-left">
                          <thead>
                            <tr className="bg-[#F8FAFC]">
                              <th className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
                                Tiêu chí
                              </th>
                              <th className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
                                Yêu cầu JD &amp; Hồ sơ ứng viên
                              </th>
                              <th className="px-3 py-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-600">
                                Đánh giá
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {criteria.map((c) => (
                              <tr key={c.key} className="border-t border-slate-100 align-top">
                                <td className="px-3 py-2 text-[11.5px] font-semibold text-[#072348]">
                                  {c.label}
                                </td>
                                <td className="px-3 py-2 text-[11.5px] leading-relaxed text-slate-600">
                                  {c.jdRequirement ? (
                                    <span className="block">
                                      <span className="font-medium text-slate-700">JD yêu cầu:</span> {c.jdRequirement}
                                    </span>
                                  ) : null}
                                  {c.candidateEvidence ? (
                                    <span className="block">
                                      <span className="font-medium text-slate-700">Ứng viên:</span> {c.candidateEvidence}
                                    </span>
                                  ) : (
                                    <span className="block text-slate-400">Ứng viên chưa cập nhật</span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <span
                                    className={clsx(
                                      'inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold',
                                      c.status === 'MATCHED'
                                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80'
                                        : c.status === 'PARTIAL'
                                          ? 'bg-amber-50 text-[#c96a12] ring-1 ring-amber-200/80'
                                          : c.status === 'MISMATCH'
                                            ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/80'
                                            : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/80',
                                    )}
                                  >
                                    {c.status === 'MATCHED'
                                      ? 'Khớp'
                                      : c.status === 'PARTIAL'
                                        ? 'Khớp một phần'
                                        : c.status === 'MISMATCH'
                                          ? 'Chưa khớp'
                                          : 'Chưa cập nhật'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                ) : !candidateRow.match.reason ? (
                  <p className="text-xs leading-relaxed text-slate-600">{candidateRow.match.reason}</p>
                ) : null}
              </div>
            );
          })()}

          {/* Mở khóa hồ sơ & Liên hệ / Kết nối ứng viên */}
          <div ref={contactRef}>
          {!unlocked ? (
            <div className="rounded-2xl border-2 border-[#E8872A]/40 bg-gradient-to-br from-amber-50/90 to-white p-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#E8872A] text-white">
                  <Lock className="h-5 w-5" />
                </span>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-[#072348]">
                    Mở khóa toàn bộ Hồ sơ chi tiết, Liên hệ & Kết nối ngay tại đây
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Ứng viên này có tỉ lệ phù hợp <strong>{pctStr}%</strong> (mức mở hồ sơ:{' '}
                    <strong>{creditCost} Credit</strong>). Hệ thống sẽ{' '}
                    <strong>ưu tiên trừ trực tiếp từ {resource?.creditBalance ?? entitlements.profileOpensRemaining ?? 0} Credit có sẵn trong Gói Săn</strong>{' '}
                    của bạn mà không làm tốn ví Credit mua lẻ.
                  </p>
                  <div
                    className={clsx(
                      'mt-3.5 grid gap-2.5',
                      hasOutreach && !isOutreached ? 'sm:grid-cols-2' : 'sm:max-w-xs',
                    )}
                  >
                    <button
                      type="button"
                      disabled={unlockMutation.isPending}
                      onClick={() => unlockMutation.mutate()}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#072348] px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#0d356c] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {unlockMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#FFB366]" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#FFB366]" />
                      )}
                      <span className="whitespace-nowrap">Mở khóa &amp; Liên hệ</span>
                      <span className="shrink-0 rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-[#FFD0A3]">
                        -{creditCost} Credit
                      </span>
                    </button>

                    {hasOutreach && !isOutreached ? (
                      <button
                        type="button"
                        disabled={
                          outreachMutation.isPending ||
                          (outreachRemaining != null && outreachRemaining <= 0)
                        }
                        onClick={() => setShowOutreachForm(true)}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#072348]/20 bg-white px-3.5 text-xs font-bold text-[#072348] shadow-2xs transition hover:border-[#072348]/45 hover:bg-[#f4f8fd] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Headphones className="h-3.5 w-3.5 shrink-0 text-[#E8872A]" />
                        <span className="whitespace-nowrap">Giao Inlink mở khóa</span>
                        <span className="shrink-0 rounded-md bg-[#FFF4E8] px-2 py-0.5 text-[11px] font-extrabold tabular-nums text-[#C86D18] ring-1 ring-inset ring-[#FFD0A3]/70">
                          Còn {outreachRemaining ?? 0}/{outreachQuota}
                        </span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : loadingDetail ? (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Đang tải chi tiết hồ sơ ứng viên...
            </div>
          ) : detail ? (
            <>
              {/* Thông tin liên hệ & Kết nối */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[#d7e3f2] bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-wide text-[#072348]">
                      Thông tin liên hệ
                    </h4>
                    {/* ⭐ Badge xanh lá khi đã mở khóa liên hệ. */}
                    {detail.contactUnlocked && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        <CheckCircle2 className="h-3 w-3" />
                        Đã mở khóa liên hệ
                      </span>
                    )}
                  </div>
                  <div className="mt-2.5 space-y-2 text-xs">
                    <p className="flex items-center gap-2 text-slate-700">
                      <Phone className="h-3.5 w-3.5 shrink-0 text-[#E8872A]" />
                      <span className="font-semibold text-slate-500">Điện thoại:</span>
                      {detail.contactUnlocked && detail.phone ? (
                        <a
                          href={`tel:${detail.phone}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {detail.phone}
                        </a>
                      ) : (
                        <span className="font-medium text-slate-400">
                          {detail.phoneMasked || 'Chưa cập nhật'}
                        </span>
                      )}
                    </p>
                    <p className="flex items-center gap-2 text-slate-700">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-[#E8872A]" />
                      <span className="font-semibold text-slate-500">Email:</span>
                      {detail.contactUnlocked && detail.email ? (
                        <a
                          href={`mailto:${detail.email}`}
                          className="break-all font-medium text-brand-700 hover:underline"
                        >
                          {detail.email}
                        </a>
                      ) : (
                        <span className="font-medium text-slate-400">
                          {detail.emailMasked || 'Chưa cập nhật'}
                        </span>
                      )}
                    </p>
                    <p className="flex items-center gap-2 text-slate-700">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[#E8872A]" />
                      <span className="font-semibold text-slate-500">Địa điểm:</span>
                      <span>{detail.profile?.sales?.desiredLocations?.[0] || candidateRow.location || 'Chưa cập nhật'}</span>
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#d7e3f2] bg-white p-4">
                  {/* Ứng viên đã nộp đơn → nhắn tin trao đổi, KHÔNG mời ứng tuyển. */}
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-[#072348]">
                    {candidateRow.applied
                      ? 'Nhắn tin trao đổi'
                      : detail.contactUnlocked
                        ? 'Kết nối trên Inlink (Tùy chọn)'
                        : 'Kết nối & Mời ứng tuyển'}
                  </h4>
                  {/* ⭐ Đã mở khóa liên hệ → gợi ý ngắn, KHÔNG bắt buộc phải kết nối. */}
                  {detail.contactUnlocked && !candidateRow.applied && (
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                      Bạn đã có thể gọi điện/email trực tiếp, hoặc gửi lời mời ứng tuyển /
                      nhắn tin trên Inlink để theo dõi trong quy trình.
                    </p>
                  )}
                  {/* ⭐ Chưa mở khóa → nhắc NTD mở khóa trước (không để lách Credit). */}
                  {!detail.contactUnlocked && !candidateRow.applied && (
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                      Hãy mở khóa hồ sơ trước để gửi lời mời ứng tuyển hoặc nhắn tin trực tiếp
                      cho ứng viên.
                    </p>
                  )}
                  {connectionStatus === ConnectionStatus.Accepted && connectionId ? (
                    <div className="mt-2.5 space-y-2">
                      <p className="text-xs font-semibold text-emerald-700">
                        ✓ Ứng viên đã đồng ý kết nối. Bạn có thể nhắn tin trực tiếp ngay!
                      </p>
                      <Button
                        className="w-full"
                        onClick={() => openConnectionChat(connectionId)}
                      >
                        <MessageCircle className="h-4 w-4" />
                        Mở khung Chat trao đổi
                      </Button>
                    </div>
                  ) : connectionStatus === ConnectionStatus.Pending ? (
                    <p className="mt-2.5 text-xs font-medium text-amber-800">
                      Đã gửi lời mời kết nối. Đang chờ ứng viên xác nhận qua Email/Hệ thống.
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      <textarea
                        rows={2}
                        value={connectMessage}
                        onChange={(e) => setConnectMessage(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-[#072348]"
                        placeholder={
                          candidateRow.applied
                            ? 'Lời nhắn trao đổi với ứng viên...'
                            : 'Lời nhắn mời ứng viên...'
                        }
                      />
                      <Button
                        className="w-full"
                        disabled={connectMutation.isPending}
                        onClick={() => connectMutation.mutate()}
                      >
                        {connectMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserPlus className="h-4 w-4" />
                        )}
                        {candidateRow.applied
                          ? 'Gửi tin nhắn cho ứng viên'
                          : 'Gửi yêu cầu kết nối / Mời ứng tuyển'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Tóm tắt & Kỳ vọng */}
              <div className="rounded-2xl border border-[#d7e3f2] bg-white p-4 space-y-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-[#072348]">
                  Tóm tắt chuyên môn & Kỳ vọng
                </h4>
                {detail.profile?.summary || detail.aiProfile?.summary ? (
                  looksLikeHtml(detail.profile?.summary || detail.aiProfile?.summary) ? (
                    <SafeHtml
                      html={detail.profile?.summary || detail.aiProfile?.summary}
                      className="text-xs leading-relaxed text-slate-700"
                    />
                  ) : (
                    <p className="whitespace-pre-line text-xs leading-relaxed text-slate-700">
                      {detail.profile?.summary || detail.aiProfile?.summary}
                    </p>
                  )
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1 text-xs">
                  {detail.profile?.jobLevel ? (
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                      Cấp bậc: {formatJobLevel(detail.profile.jobLevel)}
                    </span>
                  ) : null}
                  {detail.profile?.sales?.expectedSalaryMin != null ? (
                    <span className="rounded-lg bg-amber-50 px-2.5 py-1 font-semibold text-amber-900">
                      Lương kỳ vọng: {formatVndAmount(detail.profile.sales.expectedSalaryMin)}
                      {detail.profile?.sales?.expectedSalaryMax != null
                        ? ` – ${formatVndAmount(detail.profile.sales.expectedSalaryMax)}`
                        : ''}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Kinh nghiệm làm việc (rút gọn 140 từ + nút Xem thêm) */}
              {experiences.length > 0 ? (
                <div className="rounded-2xl border border-[#d7e3f2] bg-white p-4">
                  <h4 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-[#072348]">
                    <Briefcase className="h-3.5 w-3.5 text-[#E8872A]" />
                    Kinh nghiệm làm việc ({experiences.length})
                  </h4>
                  <div className="mt-3 space-y-3">
                    {visibleExperiences.map((exp) => (
                      <div key={exp.id} className="border-l-2 border-[#d7e3f2] pl-3">
                        <p className="text-xs font-bold text-slate-900">
                          {exp.jobTitle} · <span className="font-semibold text-[#072348]">{exp.companyName}</span>
                        </p>
                        {exp.truncatedHighlights ? (
                          <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-600">
                            {exp.truncatedHighlights}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {shouldTruncateExp ? (
                    <button
                      type="button"
                      onClick={() => setExpandedExp((v) => !v)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-[#FFD0A3] bg-[#FFF8F1] px-3.5 py-1.5 text-xs font-bold text-[#072348] transition hover:border-[#E8872A] hover:bg-[#FFEEDB]"
                    >
                      {expandedExp ? 'Thu gọn kinh nghiệm làm việc ↑' : 'Xem thêm toàn bộ kinh nghiệm làm việc ↓'}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
