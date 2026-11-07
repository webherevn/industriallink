'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertCircle,
  BookmarkCheck,
  Briefcase,
  Calendar,
  CheckCircle2,
  ExternalLink,
  FileBarChart2,
  ListChecks,
  Loader2,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Printer,
  RefreshCw,
  Save,
  Sparkles,
  TrendingUp,
  UserPlus,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ConnectionStatus,
  InterviewType,
  JobTrack,
  formatJobLevel,
  formatJobTitle,
  type CandidateMatchView,
  type RecruiterSourcingEntitlements,
  type RecruiterSourcingReportView,
  type RecruiterSourcingScanRoundView,
  type RecruiterSourcingWorkspace,
} from '@industriallink/contracts';
import { handleCreditError, useCreditAlert } from '@/components/credit-alert-provider';
import { JdSalesForm } from '@/components/jd-sales-form';
import { JdTechnicalForm } from '@/components/jd-technical-form';
import { Button, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  addCandidateShortlist,
  getCandidateById,
  openConnectionChat,
  requestCandidateConnection,
} from '@/lib/candidate';
import { formatVndAmount } from '@/lib/format';
import { scheduleInterview } from '@/lib/interviews';
import {
  emptyJdSalesForm,
  formToCreateJobRequest,
  jobViewToForm,
  type JdSalesFormState,
} from '@/lib/jd-sales-form';
import {
  emptyJdTechnicalForm,
  formToCreateTechnicalJobRequest,
  jobViewToTechnicalForm,
  type JdTechnicalFormState,
} from '@/lib/jd-technical-form';
import { getJob, updateJob } from '@/lib/jobs';
import { formatMatchPct, matchRingColor } from '@/lib/match-percent';
import { sourcingCandidatesForJob } from '@/lib/matching';
import { consumeRecruiterSourcing } from '@/lib/recruiter-billing';

function potentialCreditCost(score: number): 1 | 2 {
  const pct = score <= 1 ? score * 100 : score;
  return pct >= 80 ? 2 : 1;
}

function trackFromJob(job: {
  jobTrack?: string | null;
  jobLevel?: string | null;
  salesCriteria?: unknown;
  technicalCriteria?: unknown;
}): JobTrack {
  if (
    job.jobTrack === JobTrack.Technical ||
    job.jobLevel?.startsWith('technical.') ||
    job.technicalCriteria
  ) {
    return JobTrack.Technical;
  }
  if (job.jobTrack === JobTrack.Sales || job.jobLevel?.startsWith('sales.') || job.salesCriteria) {
    return JobTrack.Sales;
  }
  return JobTrack.Sales;
}

// ============================================================================
// 1. MODAL BÁO CÁO TIẾN ĐỘ & KHUYẾN NGHỊ AI (4 KỲ)
// ============================================================================

export function SourcingProgressReportModal({
  open,
  onClose,
  engagementId,
  engagementTitle,
  jobId,
  entitlements,
  allResults,
  scanRounds,
  shortlistedIds,
  savedReports,
  onWorkspaceUpdated,
}: {
  open: boolean;
  onClose: () => void;
  engagementId: string | null;
  engagementTitle: string;
  jobId: string | null;
  entitlements: RecruiterSourcingEntitlements;
  allResults: CandidateMatchView[];
  scanRounds: RecruiterSourcingScanRoundView[];
  shortlistedIds: string[];
  savedReports: RecruiterSourcingReportView[];
  onWorkspaceUpdated: (ws: RecruiterSourcingWorkspace, msg: string) => void;
}) {
  const [tab, setTab] = useState<'live' | 'history'>('live');
  const [errText, setErrText] = useState<string | null>(null);

  const analytics = useMemo(() => {
    const totalMatched = allResults.length;
    const highMatch = allResults.filter((r) => {
      const pct = r.match.score <= 1 ? r.match.score * 100 : r.match.score;
      return pct >= 80;
    });
    const mediumMatch = allResults.filter((r) => {
      const pct = r.match.score <= 1 ? r.match.score * 100 : r.match.score;
      return pct >= 60 && pct < 80;
    });
    const opened = allResults.filter((r) => r.viewed || r.applied);
    const applied = allResults.filter((r) => r.applied);
    const unviewedHigh = highMatch.filter((r) => !r.viewed && !r.applied);

    const missingFreq = new Map<string, number>();
    const matchedFreq = new Map<string, number>();
    for (const r of allResults) {
      for (const m of r.match.missingSkills ?? []) {
        const clean = m.trim();
        if (clean) missingFreq.set(clean, (missingFreq.get(clean) ?? 0) + 1);
      }
      for (const m of r.match.matchedSkills ?? []) {
        const clean = m.trim();
        if (clean) matchedFreq.set(clean, (matchedFreq.get(clean) ?? 0) + 1);
      }
    }

    const topMissing = [...missingFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const topStrengths = [...matchedFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    const bottlenecks: string[] = [];
    if (topMissing.length > 0) {
      bottlenecks.push(
        `Các tiêu chí đang làm giảm điểm phù hợp của nhiều ứng viên nhất: ${topMissing
          .map(([label, cnt]) => `${label} (${cnt} hồ sơ)`)
          .join(', ')}.`,
      );
    } else if (totalMatched === 0) {
      bottlenecks.push(
        'Hiện tại tiêu chí JD đang khá hẹp nên chưa có hồ sơ đạt ngưỡng khớp. Nên cân nhắc mở rộng ngành hàng phụ hoặc khu vực lân cận.',
      );
    } else {
      bottlenecks.push(
        'Tập tiêu chí JD hiện tại có độ tương thích tốt với nguồn ứng viên trên hệ thống.',
      );
    }

    if (topStrengths.length > 0) {
      bottlenecks.push(
        `Điểm mạnh nổi bật của tệp ứng viên hiện tại: ${topStrengths
          .map(([label, cnt]) => `${label} (${cnt} hồ sơ)`)
          .join(', ')}.`,
      );
    }

    const recommendations: string[] = [];
    if (unviewedHigh.length > 0) {
      recommendations.push(
        `Ưu tiên mở ngay ${unviewedHigh.length} hồ sơ có độ phù hợp cao (≥ 80%) chưa xem bằng Credit miễn phí trong gói Săn để tiếp cận ứng viên sớm nhất.`,
      );
    }
    if (shortlistedIds.length === 0 && totalMatched > 0) {
      recommendations.push(
        `Hãy chọn từ 3–5 ứng viên tiềm năng nhất đưa vào danh sách Shortlist (còn ${
          entitlements.shortlistsRemaining ?? '∞'
        } lượt) để gửi yêu cầu kết nối và đặt lịch phỏng vấn.`,
      );
    } else if (shortlistedIds.length > 0) {
      recommendations.push(
        `Bạn đã chọn ${shortlistedIds.length} ứng viên vào Shortlist. Hãy bấm trực tiếp vào từng ứng viên để Gửi kết nối và Đặt lịch phỏng vấn ngay trên trang.`,
      );
    }
    if (highMatch.length < 3 && (entitlements.revisionsRemaining ?? 0) > 0) {
      recommendations.push(
        `Số lượng ứng viên ≥ 80% hiện mới có ${highMatch.length} người. Khuyến nghị dùng 1 lượt «Điều chỉnh tiêu chí» (còn ${entitlements.revisionsRemaining} lượt) để nới nhẹ tiêu chí phụ và quét lại kho ứng viên.`,
      );
    } else {
      recommendations.push(
        'Hệ thống inlink vẫn đang tiếp tục quét tự động 2 giờ/lần (08:00–18:00) và sẽ gửi Email ngay khi phát hiện ứng viên mới cập nhật hồ sơ.',
      );
    }

    return {
      totalScanned: Math.max(totalMatched * 4, scanRounds.length * 12, totalMatched),
      totalMatched,
      highMatchCount: highMatch.length,
      mediumMatchCount: mediumMatch.length,
      openedCount: opened.length,
      shortlistedCount: shortlistedIds.length,
      appliedCount: applied.length,
      bottlenecks,
      recommendations,
    };
  }, [allResults, scanRounds.length, shortlistedIds.length, entitlements]);

  const saveReportMutation = useMutation({
    mutationFn: () => {
      if (!engagementId) throw new Error('Chưa chọn vị trí Tin Săn');
      const nextNum = savedReports.length + 1;
      const reportPayload = {
        reportNumber: nextNum,
        title: `Báo cáo tiến độ tuần #${nextNum} - ${engagementTitle}`,
        totalScanned: analytics.totalScanned,
        highMatchCount: analytics.highMatchCount,
        mediumMatchCount: analytics.mediumMatchCount,
        openedCount: analytics.openedCount,
        shortlistedCount: analytics.shortlistedCount,
        appliedCount: analytics.appliedCount,
        bottlenecks: analytics.bottlenecks,
        recommendations: analytics.recommendations,
      };
      return consumeRecruiterSourcing({
        kind: 'search_round',
        engagementId,
        jobId: jobId ?? undefined,
        note: `report:${JSON.stringify(reportPayload)}`,
      });
    },
    onSuccess: (ws) => {
      setErrText(null);
      onWorkspaceUpdated(ws, 'Đã chốt & lưu Báo cáo tiến độ và khuyến nghị AI kỳ mới.');
      setTab('history');
    },
    onError: (err) => {
      setErrText(err instanceof ApiError ? err.message : 'Không lưu được báo cáo tiến độ');
    },
  });

  if (!open) return null;

  const canSaveMore =
    Boolean(engagementId) &&
    (entitlements.searchRoundsRemaining === null || entitlements.searchRoundsRemaining > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-xs sm:p-6">
      <div className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#E8872A]">
              Báo cáo tiến độ & Khuyến nghị hành động chuyên sâu
            </p>
            <h3 className="mt-0.5 text-xl font-bold text-[#072348]">
              {engagementTitle || 'Báo cáo hiệu quả Săn nhân sự'}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Đã xuất {entitlements.searchRoundsUsed} / {entitlements.searchRoundQuota ?? '∞'} kỳ báo cáo trong gói{' '}
              {entitlements.planName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <Printer className="h-3.5 w-3.5" />
              In / Xuất PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('live')}
            className={clsx(
              'rounded-full px-4 py-1.5 text-xs font-bold transition',
              tab === 'live'
                ? 'bg-[#072348] text-white'
                : 'bg-[#f4f7fb] text-slate-600 hover:bg-slate-200/70',
            )}
          >
            Phân tích & Khuyến nghị thời gian thực
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={clsx(
              'rounded-full px-4 py-1.5 text-xs font-bold transition',
              tab === 'history'
                ? 'bg-[#072348] text-white'
                : 'bg-[#f4f7fb] text-slate-600 hover:bg-slate-200/70',
            )}
          >
            Các kỳ báo cáo đã chốt ({savedReports.length})
          </button>
        </div>

        {tab === 'live' ? (
          <div className="mt-5 space-y-5">
            {/* Phễu số liệu */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-3">
                <p className="text-[11px] font-semibold text-slate-500">Đợt quét 2h/lần</p>
                <p className="mt-1 text-xl font-extrabold text-[#072348]">{scanRounds.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-3">
                <p className="text-[11px] font-semibold text-slate-500">Tổng phù hợp</p>
                <p className="mt-1 text-xl font-extrabold text-[#072348]">{analytics.totalMatched}</p>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
                <p className="text-[11px] font-semibold text-amber-900">Khớp cao ≥ 80%</p>
                <p className="mt-1 text-xl font-extrabold text-[#E8872A]">{analytics.highMatchCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-[#f8fafc] p-3">
                <p className="text-[11px] font-semibold text-slate-500">Đã mở hồ sơ</p>
                <p className="mt-1 text-xl font-extrabold text-[#072348]">{analytics.openedCount}</p>
              </div>
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3">
                <p className="text-[11px] font-semibold text-indigo-900">Đã Shortlist</p>
                <p className="mt-1 text-xl font-extrabold text-indigo-700">{analytics.shortlistedCount}</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
                <p className="text-[11px] font-semibold text-emerald-900">Nộp ứng tuyển</p>
                <p className="mt-1 text-xl font-extrabold text-emerald-700">{analytics.appliedCount}</p>
              </div>
            </div>

            {/* Phân tích điểm nghẽn & tiêu chí */}
            <div className="rounded-2xl border border-[#d7e3f2] bg-[#f8fafc] p-4">
              <h4 className="flex items-center gap-2 text-sm font-bold text-[#072348]">
                <TrendingUp className="h-4 w-4 text-[#E8872A]" />
                1. Phân tích Tệp Ứng Viên & Điểm Nghẽn Tiêu Chí (AI Matching Diagnostic)
              </h4>
              <ul className="mt-2.5 space-y-2 text-xs leading-relaxed text-slate-700">
                {analytics.bottlenecks.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#072348]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Khuyến nghị hành động hàng tuần */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <h4 className="flex items-center gap-2 text-sm font-bold text-[#072348]">
                <Sparkles className="h-4 w-4 text-[#E8872A]" />
                2. Khuyến nghị Hành động Tuần này từ inlink
              </h4>
              <ul className="mt-2.5 space-y-2 text-xs leading-relaxed text-slate-800">
                {analytics.recommendations.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#E8872A]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {errText ? (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{errText}</p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">
                * Bạn có thể xem phân tích thời gian thực miễn phí bất cứ lúc nào. Bấm nút bên phải khi muốn chốt 1 kỳ
                báo cáo tuần chính thức vào hồ sơ gói Săn.
              </p>
              <Button
                disabled={!canSaveMore || saveReportMutation.isPending}
                onClick={() => saveReportMutation.mutate()}
              >
                {saveReportMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileBarChart2 className="h-4 w-4" />
                )}
                Chốt & Lưu Báo cáo Kỳ #{savedReports.length + 1} (Còn {entitlements.searchRoundsRemaining ?? '∞'})
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {savedReports.length === 0 ? (
              <div className="rounded-2xl bg-[#f8fafc] px-4 py-10 text-center">
                <FileBarChart2 className="mx-auto h-6 w-6 text-[#E8872A]" />
                <p className="mt-2 text-sm font-semibold text-slate-700">Chưa có kỳ báo cáo nào được lưu</p>
                <p className="mt-1 text-xs text-slate-500">
                  Chuyển sang tab «Phân tích & Khuyến nghị thời gian thực» và bấm Chốt & Lưu Báo cáo để lưu lại tiến độ
                  từng tuần.
                </p>
              </div>
            ) : (
              savedReports.map((rep) => (
                <div key={rep.id} className="rounded-2xl border border-[#d7e3f2] bg-white p-4 shadow-2xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="font-bold text-[#072348]">{rep.title}</h4>
                    <span className="text-xs text-slate-400">
                      {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(
                        new Date(rep.createdAt),
                      )}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                      Khớp ≥80%: {rep.highMatchCount}
                    </span>
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                      Khớp 60–79%: {rep.mediumMatchCount}
                    </span>
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                      Đã mở hồ sơ: {rep.openedCount}
                    </span>
                    <span className="rounded-lg bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-700">
                      Shortlist: {rep.shortlistedCount}
                    </span>
                    <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                      Ứng tuyển: {rep.appliedCount}
                    </span>
                  </div>
                  {rep.recommendations.length > 0 ? (
                    <div className="mt-3 rounded-xl bg-amber-50/60 p-3 text-xs text-slate-700">
                      <p className="font-bold text-[#072348]">Khuyến nghị tại kỳ báo cáo:</p>
                      <ul className="mt-1 list-disc space-y-1 pl-4">
                        {rep.recommendations.map((rec, idx) => (
                          <li key={idx}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 2. MODAL ĐIỀU CHỈNH TIÊU CHÍ JD TẠI CHỖ & QUÉT LẠI NGAY
// ============================================================================

export function SourcingJdRevisionModal({
  open,
  onClose,
  engagementId,
  jobId,
  revisionsRemaining,
  onWorkspaceUpdated,
}: {
  open: boolean;
  onClose: () => void;
  engagementId: string | null;
  jobId: string | null;
  revisionsRemaining: number | null;
  onWorkspaceUpdated: (ws: RecruiterSourcingWorkspace, msg: string) => void;
}) {
  const qc = useQueryClient();
  const { data: job, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJob(jobId!),
    enabled: Boolean(open && jobId),
  });

  const [salesForm, setSalesForm] = useState<JdSalesFormState>(emptyJdSalesForm);
  const [techForm, setTechForm] = useState<JdTechnicalFormState>(emptyJdTechnicalForm);
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [errText, setErrText] = useState<string | null>(null);

  const isSales = job ? trackFromJob(job) === JobTrack.Sales : true;

  useEffect(() => {
    if (!job || hydratedId === job.id) return;
    setSalesForm(jobViewToForm(job));
    setTechForm(jobViewToTechnicalForm(job));
    setHydratedId(job.id);
  }, [job, hydratedId]);

  const reviseMutation = useMutation({
    mutationFn: async () => {
      if (!jobId || !engagementId) throw new Error('Chưa có JD gắn với Tin Săn này');
      if (isSales) {
        const { publish: _publish, ...payload } = formToCreateJobRequest(salesForm, false);
        await updateJob(jobId, payload);
      } else {
        const { publish: _publish, ...payload } = formToCreateTechnicalJobRequest(techForm, false);
        await updateJob(jobId, payload);
      }
      await consumeRecruiterSourcing({
        kind: 'revision',
        engagementId,
        jobId,
        note: `Điều chỉnh tiêu chí JD «${isSales ? salesForm.title : techForm.title}» & chạy quét lại ứng viên`,
      });
      await sourcingCandidatesForJob(jobId, true);
      const refreshedWs = await qc.fetchQuery({
        queryKey: ['recruiter-sourcing'],
      });
      return refreshedWs as RecruiterSourcingWorkspace;
    },
    onSuccess: (ws) => {
      setErrText(null);
      void qc.invalidateQueries({ queryKey: ['job', jobId] });
      void qc.invalidateQueries({ queryKey: ['my-jobs'] });
      void qc.invalidateQueries({ queryKey: ['sourcing-hunt', jobId] });
      onWorkspaceUpdated(
        ws,
        'Đã lưu điều chỉnh tiêu chí JD và thực hiện đợt quét ứng viên mới ngay lập tức!',
      );
      onClose();
    },
    onError: (err) => {
      setErrText(err instanceof ApiError ? err.message : 'Không lưu được điều chỉnh tiêu chí JD');
    },
  });

  if (!open) return null;

  const outOfRevisions = revisionsRemaining !== null && revisionsRemaining <= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-xs sm:p-6">
      <div className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#E8872A]">
              Tối ưu & Điều chỉnh tiêu chí Matching (All-in-One)
            </p>
            <h3 className="mt-0.5 text-xl font-bold text-[#072348]">
              Điều chỉnh tiêu chí Tin Săn · Còn {revisionsRemaining ?? '∞'} lượt
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Chỉnh sửa trực tiếp mức lương, khu vực, kinh nghiệm hoặc yêu cầu chuyên môn tại đây — hệ thống sẽ tự động
              quét lại danh sách ứng viên ngay lập tức.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!jobId ? (
          <div className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
            Tin Săn này chưa gắn JD. Hãy tạo hoặc gắn JD trước khi điều chỉnh tiêu chí.
          </div>
        ) : isLoading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tải tiêu chí JD hiện tại...
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {isSales ? (
              <JdSalesForm
                form={salesForm}
                onChange={(partial) => setSalesForm((prev) => ({ ...prev, ...partial }))}
                uncertainKeys={[]}
                disabled={reviseMutation.isPending || outOfRevisions}
              />
            ) : (
              <JdTechnicalForm
                form={techForm}
                onChange={(partial) => setTechForm((prev) => ({ ...prev, ...partial }))}
                uncertainKeys={[]}
                disabled={reviseMutation.isPending || outOfRevisions}
              />
            )}

            {errText ? (
              <p className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {errText}
              </p>
            ) : null}

            <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 pt-4 backdrop-blur-xs">
              <Button type="button" variant="outline" onClick={onClose}>
                Hủy
              </Button>
              <Button
                type="button"
                disabled={reviseMutation.isPending || outOfRevisions}
                onClick={() => reviseMutation.mutate()}
              >
                {reviseMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Lưu điều chỉnh & Quét lại ứng viên ngay (-1 lượt Điều chỉnh)
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 3. SLIDE-OVER DRAWER XỬ LÝ ỨNG VIÊN ALL-IN-ONE NGAY TRÊN TRANG SĂN NHÂN SỰ
// ============================================================================

export function SourcingCandidateDrawer({
  candidateRow,
  onClose,
  engagementId,
  engagementTitle,
  jobId,
  entitlements,
  isShortlisted,
  onShortlistSuccess,
  onProfileUnlocked,
}: {
  candidateRow: CandidateMatchView | null;
  onClose: () => void;
  engagementId: string | null;
  engagementTitle: string;
  jobId: string | null;
  entitlements: RecruiterSourcingEntitlements;
  isShortlisted: boolean;
  onShortlistSuccess: (ws: RecruiterSourcingWorkspace, candidateName: string) => void;
  onProfileUnlocked: () => void;
}) {
  const qc = useQueryClient();
  const { showAlert: showCreditAlert } = useCreditAlert();
  const [unlocked, setUnlocked] = useState(false);
  const [connectMessage, setConnectMessage] = useState('');
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [interviewAt, setInterviewAt] = useState('');
  const [interviewType, setInterviewType] = useState<InterviewType>(InterviewType.Hr);
  const [interviewMode, setInterviewMode] = useState<'online' | 'onsite'>('online');
  const [interviewLocation, setInterviewLocation] = useState('');
  const [interviewNote, setInterviewNote] = useState('');
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!candidateRow) return;
    setUnlocked(Boolean(candidateRow.viewed || candidateRow.applied));
    setConnectMessage(
      `Chào ${candidateRow.displayName}, công ty chúng tôi đang tuyển vị trí «${engagementTitle}» rất phù hợp với kinh nghiệm của bạn trên inlink. Mong được kết nối trao đổi thêm cùng bạn!`,
    );
    setShowInterviewForm(false);
    setFeedback(null);
  }, [candidateRow, engagementTitle]);

  const pctStr = candidateRow ? formatMatchPct(candidateRow.match.score) : '0';
  const creditCost = candidateRow ? potentialCreditCost(candidateRow.match.score) : 1;

  const {
    data: detail,
    isLoading: loadingDetail,
    refetch: fetchDetail,
  } = useQuery({
    queryKey: ['sourcing-candidate-drawer', candidateRow?.candidateId, unlocked],
    queryFn: async () => {
      const res = await getCandidateById(candidateRow!.candidateId, 'sourcing', pctStr);
      onProfileUnlocked();
      return res;
    },
    enabled: Boolean(candidateRow?.candidateId && unlocked),
    retry: false,
  });

  const unlockMutation = useMutation({
    mutationFn: async () => {
      if (!candidateRow) throw new Error('Chưa chọn ứng viên');
      return getCandidateById(candidateRow.candidateId, 'sourcing', pctStr);
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
      if (!candidateRow || !engagementId) throw new Error('Chưa chọn vị trí Săn');
      await addCandidateShortlist(candidateRow.candidateId).catch(() => null);
      return consumeRecruiterSourcing({
        kind: 'shortlist',
        engagementId,
        jobId: jobId ?? undefined,
        note: `shortlist:${candidateRow.candidateId}:${candidateRow.displayName}`,
      });
    },
    onSuccess: (ws) => {
      if (candidateRow) {
        onShortlistSuccess(ws, candidateRow.displayName);
      }
      setFeedback({
        tone: 'ok',
        text: `Đã đưa «${candidateRow?.displayName}» vào danh sách Shortlist!`,
      });
    },
    onError: (err) => {
      setFeedback({
        tone: 'err',
        text: err instanceof ApiError ? err.message : 'Không đưa được vào Shortlist',
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

  const ringColor = matchRingColor(candidateRow.match.score);
  const connectionStatus = detail?.connection?.status ?? null;
  const connectionId = detail?.connection?.id ?? null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs">
      <div className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
        {/* Header cố định */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-[#072348] px-5 py-4 text-white sm:px-6">
          <div className="flex items-center gap-3.5">
            <div
              className="flex h-13 w-13 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/10 ring-2"
              style={{ borderColor: ringColor }}
            >
              <span className="text-sm font-extrabold text-amber-300">{pctStr}%</span>
              <span className="text-[9px] uppercase tracking-wider text-white/75">Phù hợp</span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-white">{candidateRow.displayName}</h3>
                {candidateRow.applied ? (
                  <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold text-emerald-200 ring-1 ring-emerald-300/40">
                    Đã nộp đơn
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-200 ring-1 ring-amber-300/40">
                    Ứng viên inlink săn
                  </span>
                )}
                {isShortlisted ? (
                  <span className="rounded-full bg-indigo-400/25 px-2 py-0.5 text-[10px] font-bold text-indigo-100 ring-1 ring-indigo-300/40">
                    ★ Đã Shortlist
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-white/80">
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
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Thanh công cụ All-in-One cố định ngay dưới Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-[#f8fafc] px-5 py-2.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={
                isShortlisted ||
                shortlistMutation.isPending ||
                (entitlements.shortlistsRemaining !== null && entitlements.shortlistsRemaining <= 0)
              }
              onClick={() => shortlistMutation.mutate()}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition',
                isShortlisted
                  ? 'bg-indigo-100 text-indigo-800'
                  : 'bg-[#072348] text-white hover:bg-[#0d3b80] disabled:opacity-45',
              )}
            >
              {shortlistMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isShortlisted ? (
                <BookmarkCheck className="h-3.5 w-3.5" />
              ) : (
                <ListChecks className="h-3.5 w-3.5" />
              )}
              {isShortlisted
                ? 'Đã trong Shortlist'
                : `+ Đưa vào Shortlist (Còn ${entitlements.shortlistsRemaining ?? '∞'})`}
            </button>

            <button
              type="button"
              onClick={() => setShowInterviewForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#d7e3f2] bg-white px-3 py-1.5 text-xs font-bold text-[#072348] transition hover:border-[#072348]"
            >
              <Calendar className="h-3.5 w-3.5 text-[#E8872A]" />
              Đặt lịch phỏng vấn
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

          {/* Form đặt lịch phỏng vấn nhanh tại chỗ */}
          {showInterviewForm ? (
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
          ) : null}

          {/* 1. Đánh giá Matching theo JD */}
          <div className="rounded-2xl border border-[#d7e3f2] bg-white p-4 shadow-2xs">
            <h4 className="text-xs font-extrabold uppercase tracking-wide text-[#072348]">
              1. Đối chiếu mức độ phù hợp với JD ({pctStr}%)
            </h4>
            {candidateRow.match.reason ? (
              <p className="mt-2 text-xs leading-relaxed text-slate-700">{candidateRow.match.reason}</p>
            ) : null}

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-emerald-50/70 p-3">
                <p className="text-[11px] font-bold text-emerald-900">
                  ✓ Điểm mạnh khớp JD ({(candidateRow.match.matchedSkills ?? []).length})
                </p>
                {(candidateRow.match.matchedSkills ?? []).length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(candidateRow.match.matchedSkills ?? []).map((s) => (
                      <span
                        key={s}
                        className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-500">Đang tổng hợp theo kinh nghiệm tổng quát.</p>
                )}
              </div>

              <div className="rounded-xl bg-amber-50/70 p-3">
                <p className="text-[11px] font-bold text-amber-900">
                  ! Điểm cần lưu ý / Kiểm tra khi PV ({(candidateRow.match.missingSkills ?? []).length})
                </p>
                {(candidateRow.match.missingSkills ?? []).length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {(candidateRow.match.missingSkills ?? []).map((s) => (
                      <span
                        key={s}
                        className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-amber-200"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-emerald-700">Đáp ứng đầy đủ các tiêu chí chính của JD.</p>
                )}
              </div>
            </div>
          </div>

          {/* 2. Mở khóa hồ sơ & Liên hệ / Kết nối ứng viên */}
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
                    <strong>ưu tiên trừ trực tiếp từ {entitlements.profileOpensRemaining ?? 0} Credit có sẵn trong Gói Săn</strong>{' '}
                    của bạn mà không làm tốn ví Credit mua lẻ.
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
                    Mở khóa Hồ sơ & Liên hệ ngay (-{creditCost} Credit Gói Săn)
                  </Button>
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
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-[#072348]">
                    Thông tin liên hệ
                  </h4>
                  <div className="mt-2.5 space-y-2 text-xs">
                    <p className="flex items-center gap-2 text-slate-700">
                      <Mail className="h-3.5 w-3.5 text-[#E8872A]" />
                      <span className="font-medium">{detail.email || 'Chưa cập nhật'}</span>
                    </p>
                    <p className="flex items-center gap-2 text-slate-700">
                      <Phone className="h-3.5 w-3.5 text-[#E8872A]" />
                      <span className="font-medium">{detail.phone || 'Chưa cập nhật'}</span>
                    </p>
                    <p className="flex items-center gap-2 text-slate-700">
                      <MapPin className="h-3.5 w-3.5 text-[#E8872A]" />
                      <span>{detail.profile?.sales?.desiredLocations?.[0] || candidateRow.location || 'Chưa cập nhật'}</span>
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#d7e3f2] bg-white p-4">
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-[#072348]">
                    Kết nối & Mời ứng tuyển
                  </h4>
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
                        placeholder="Lời nhắn mời ứng viên..."
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
                        Gửi yêu cầu kết nối / Mời ứng tuyển
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
                  <p className="whitespace-pre-line text-xs leading-relaxed text-slate-700">
                    {detail.profile?.summary || detail.aiProfile?.summary}
                  </p>
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

              {/* Kinh nghiệm làm việc */}
              {(detail.experiences ?? []).length > 0 ? (
                <div className="rounded-2xl border border-[#d7e3f2] bg-white p-4">
                  <h4 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-[#072348]">
                    <Briefcase className="h-3.5 w-3.5 text-[#E8872A]" />
                    Kinh nghiệm làm việc ({detail.experiences.length})
                  </h4>
                  <div className="mt-3 space-y-3">
                    {detail.experiences.map((exp) => (
                      <div key={exp.id} className="border-l-2 border-[#d7e3f2] pl-3">
                        <p className="text-xs font-bold text-slate-900">
                          {exp.jobTitle} · <span className="font-semibold text-[#072348]">{exp.companyName}</span>
                        </p>
                        {exp.highlights ? (
                          <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-600">
                            {exp.highlights}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
