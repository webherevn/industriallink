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
  CUSTOMER_SEGMENTS,
  ConnectionStatus,
  DEAL_TYPE_LABEL,
  DEAL_TYPE_OPTIONS,
  DRIVER_LICENSE_TYPES,
  ExperienceBand,
  InterviewType,
  JD_TECHNICAL_AUTONOMY_OPTIONS,
  JD_TECHNICAL_SHIFT_OPTIONS,
  JOB_LEVEL_LABEL,
  type JobLevelCode,
  JobTrack,
  LANGUAGE_OPTIONS,
  MARKET_REGIONS,
  SALES_JOB_LEVELS,
  TECHNICAL_WORK_TYPES,
  TRAVEL_ABILITY_LABEL,
  TravelAbility,
  WORK_ENVIRONMENT_OPTIONS,
  allowedTechnicalLevelsForPosition,
  formatJobLevel,
  formatJobTitle,
  type CandidateMatchView,
  type RecruiterSourcingEntitlements,
  type RecruiterSourcingReportView,
  type RecruiterSourcingScanRoundView,
  type RecruiterSourcingWorkspace,
} from '@industriallink/contracts';
import { joinLocationLabels, parseJoinedLocations } from '@industriallink/vn-admin';
import { handleCreditError, useCreditAlert } from '@/components/credit-alert-provider';
import { JdSalesForm } from '@/components/jd-sales-form';
import { JdTechnicalForm } from '@/components/jd-technical-form';
import { LocationPicker } from '@/components/location-picker';
import { Button, Input, MoneyInput, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  addCandidateShortlist,
  getCandidateById,
  openConnectionChat,
  requestCandidateConnection,
} from '@/lib/candidate';
import { EXPERIENCE_LABEL, formatVndAmount } from '@/lib/format';
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-3 backdrop-blur-xs sm:p-5"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[#d7e3f2] bg-white shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#E8872A]">
              Báo cáo tiến độ & Khuyến nghị hành động chuyên sâu
            </p>
            <h3 className="mt-0.5 text-lg font-extrabold text-[#072348] sm:text-xl">
              {engagementTitle || 'Báo cáo hiệu quả Săn nhân sự'}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Đã xuất {entitlements.searchRoundsUsed} / {entitlements.searchRoundQuota ?? '∞'} kỳ báo cáo trong gói{' '}
              {entitlements.planName}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
              title="Đóng báo cáo"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center gap-2">
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
    </div>
  );
}

// ============================================================================
// 2. MODAL TỐI ƯU & ĐIỀU CHỈNH TIÊU CHÍ SĂN (SMART TUNING PANEL 5 VAN)
// ============================================================================

const EXP_RELAX_MAP: Partial<Record<ExperienceBand, ExperienceBand>> = {
  [ExperienceBand.Over5]: ExperienceBand.From3To5,
  [ExperienceBand.From3To5]: ExperienceBand.From1To3,
  [ExperienceBand.From1To3]: ExperienceBand.Under1,
  [ExperienceBand.Under1]: ExperienceBand.None,
};

function fmtMillionShort(raw: string): string {
  const n = Number(raw);
  if (!n || !Number.isFinite(n)) return 'Thoả thuận';
  if (n >= 1_000_000) return `${Math.round((n / 1_000_000) * 10) / 10}tr`;
  return formatVndAmount(n);
}

function buildSalesDiffNotes(before: JdSalesFormState, after: JdSalesFormState): string[] {
  const changes: string[] = [];
  if (before.salaryMin !== after.salaryMin || before.salaryMax !== after.salaryMax) {
    changes.push(
      `Lương ${fmtMillionShort(before.salaryMin)}–${fmtMillionShort(before.salaryMax)} → ${fmtMillionShort(after.salaryMin)}–${fmtMillionShort(after.salaryMax)}`,
    );
  }
  if (before.experienceBand !== after.experienceBand) {
    const bLabel = before.experienceBand ? EXPERIENCE_LABEL[before.experienceBand] : 'Chưa chọn';
    const aLabel = after.experienceBand ? EXPERIENCE_LABEL[after.experienceBand] : 'Chưa chọn';
    changes.push(`Kinh nghiệm ${bLabel} → ${aLabel}`);
  }
  if (before.jobLevel !== after.jobLevel) {
    const bLvl = before.jobLevel ? JOB_LEVEL_LABEL[before.jobLevel] : 'Chưa chọn';
    const aLvl = after.jobLevel ? JOB_LEVEL_LABEL[after.jobLevel] : 'Chưa chọn';
    changes.push(`Cấp bậc ${bLvl} → ${aLvl}`);
  }
  if (before.location !== after.location) {
    changes.push(`Địa điểm: ${after.location || 'Toàn quốc'}`);
  }
  if (before.industryHardMode !== after.industryHardMode) {
    const modeLabel =
      after.industryHardMode === 'off'
        ? 'Không lọc cứng ngành'
        : after.industryHardMode === 'near'
          ? 'Ngành gần ≥85%'
          : 'Đúng ngành 100%';
    changes.push(`Lọc ngành → ${modeLabel}`);
  }
  if (before.marketsCovered.join(',') !== after.marketsCovered.join(',')) {
    changes.push(`Thị trường phụ trách (${after.marketsCovered.length} vùng)`);
  }
  if (before.customerSegments.join(',') !== after.customerSegments.join(',')) {
    changes.push(`Tệp khách hàng (${after.customerSegments.length} nhóm)`);
  }
  if (before.dealTypes.join(',') !== after.dealTypes.join(',')) {
    changes.push(`Loại hình bán hàng (${after.dealTypes.length} loại)`);
  }
  if (
    before.languages.join(',') !== after.languages.join(',') ||
    before.driverLicenses.join(',') !== after.driverLicenses.join(',') ||
    before.travelAbility !== after.travelAbility
  ) {
    changes.push('Điều kiện phụ (Ngoại ngữ / Bằng lái / Công tác)');
  }
  return changes;
}

function buildTechDiffNotes(before: JdTechnicalFormState, after: JdTechnicalFormState): string[] {
  const changes: string[] = [];
  if (before.salaryMin !== after.salaryMin || before.salaryMax !== after.salaryMax) {
    changes.push(
      `Lương ${fmtMillionShort(before.salaryMin)}–${fmtMillionShort(before.salaryMax)} → ${fmtMillionShort(after.salaryMin)}–${fmtMillionShort(after.salaryMax)}`,
    );
  }
  if (before.experienceBand !== after.experienceBand) {
    const bLabel = before.experienceBand ? EXPERIENCE_LABEL[before.experienceBand] : 'Chưa chọn';
    const aLabel = after.experienceBand ? EXPERIENCE_LABEL[after.experienceBand] : 'Chưa chọn';
    changes.push(`Kinh nghiệm ${bLabel} → ${aLabel}`);
  }
  if (before.jobLevel !== after.jobLevel) {
    const bLvl = before.jobLevel ? JOB_LEVEL_LABEL[before.jobLevel] : 'Chưa chọn';
    const aLvl = after.jobLevel ? JOB_LEVEL_LABEL[after.jobLevel] : 'Chưa chọn';
    changes.push(`Cấp bậc ${bLvl} → ${aLvl}`);
  }
  if (before.location !== after.location) {
    changes.push(`Địa điểm: ${after.location || 'Toàn quốc'}`);
  }
  if (before.autonomyLevel !== after.autonomyLevel) {
    changes.push(`Mức tự chủ Mức ${before.autonomyLevel ?? '—'} → Mức ${after.autonomyLevel ?? '—'}`);
  }
  if (before.workEnvironments.join(',') !== after.workEnvironments.join(',')) {
    changes.push(`Môi trường làm việc (${after.workEnvironments.length} mục)`);
  }
  if (before.technicalWorkTypes.join(',') !== after.technicalWorkTypes.join(',')) {
    changes.push(`Công việc kỹ thuật (${after.technicalWorkTypes.length} nhóm)`);
  }
  if (
    before.languages.join(',') !== after.languages.join(',') ||
    before.driverLicenses.join(',') !== after.driverLicenses.join(',') ||
    before.travelAbility !== after.travelAbility ||
    before.shiftFlexibility !== after.shiftFlexibility
  ) {
    changes.push('Điều kiện phụ (Ngoại ngữ / Bằng lái / Ca kíp)');
  }
  return changes;
}

function toggleArrayItem(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

export function SourcingJdRevisionModal({
  open,
  onClose,
  engagementId,
  jobId,
  revisionsRemaining,
  allResults = [],
  onWorkspaceUpdated,
}: {
  open: boolean;
  onClose: () => void;
  engagementId: string | null;
  jobId: string | null;
  revisionsRemaining: number | null;
  allResults?: CandidateMatchView[];
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
  const [initialSales, setInitialSales] = useState<JdSalesFormState>(emptyJdSalesForm);
  const [initialTech, setInitialTech] = useState<JdTechnicalFormState>(emptyJdTechnicalForm);
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [showFullJd, setShowFullJd] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [errText, setErrText] = useState<string | null>(null);

  const isSales = job ? trackFromJob(job) === JobTrack.Sales : true;

  useEffect(() => {
    if (!open) {
      setConfirmDiscardOpen(false);
      setErrText(null);
      return;
    }
    if (!job || hydratedId === job.id) return;
    const s = jobViewToForm(job);
    const t = jobViewToTechnicalForm(job);
    setSalesForm(s);
    setTechForm(t);
    setInitialSales(s);
    setInitialTech(t);
    setHydratedId(job.id);
  }, [open, job, hydratedId]);

  const aiDiagnostics = useMemo(() => {
    const highCount = allResults.filter((r) => (r.match.score <= 1 ? r.match.score * 100 : r.match.score) >= 80).length;
    const medCount = allResults.filter((r) => {
      const p = r.match.score <= 1 ? r.match.score * 100 : r.match.score;
      return p >= 60 && p < 80;
    }).length;
    const missingCounts = new Map<string, number>();
    for (const r of allResults) {
      for (const m of r.match.missingSkills ?? []) {
        missingCounts.set(m, (missingCounts.get(m) ?? 0) + 1);
      }
    }
    const topMissing = [...missingCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => `${name} (${count} UV)`);

    return { highCount, medCount, totalCount: allResults.length, topMissing };
  }, [allResults]);

  const diffItems = useMemo(
    () => (isSales ? buildSalesDiffNotes(initialSales, salesForm) : buildTechDiffNotes(initialTech, techForm)),
    [isSales, initialSales, salesForm, initialTech, techForm],
  );

  const hasUnsavedChanges = useMemo(() => {
    if (diffItems.length > 0) return true;
    return isSales
      ? JSON.stringify(salesForm) !== JSON.stringify(initialSales)
      : JSON.stringify(techForm) !== JSON.stringify(initialTech);
  }, [diffItems.length, isSales, salesForm, initialSales, techForm, initialTech]);

  const handleRequestClose = () => {
    if (reviseMutation.isPending) return;
    if (hasUnsavedChanges) {
      setConfirmDiscardOpen(true);
      return;
    }
    onClose();
  };

  const handleConfirmDiscard = () => {
    setSalesForm(initialSales);
    setTechForm(initialTech);
    setConfirmDiscardOpen(false);
    setErrText(null);
    onClose();
  };

  const currentExp = isSales ? salesForm.experienceBand : techForm.experienceBand;
  const relaxedExp = currentExp ? EXP_RELAX_MAP[currentExp] : undefined;

  const currentSalaryMax = Number(isSales ? salesForm.salaryMax : techForm.salaryMax) || 0;
  const currentSalaryMin = Number(isSales ? salesForm.salaryMin : techForm.salaryMin) || 0;
  const boostedSalaryMax =
    currentSalaryMax > 0
      ? Math.round((currentSalaryMax * 1.2) / 500_000) * 500_000
      : currentSalaryMin > 0
        ? Math.round((currentSalaryMin * 1.3) / 500_000) * 500_000
        : 22_000_000;

  const applyRelaxExperience = () => {
    const nextBand = relaxedExp ?? ExperienceBand.From1To3;
    if (isSales) {
      setSalesForm((prev) => ({ ...prev, experienceBand: nextBand }));
    } else {
      setTechForm((prev) => ({ ...prev, experienceBand: nextBand }));
    }
  };

  const applyBoostSalary = () => {
    const nextMax = String(boostedSalaryMax);
    if (isSales) {
      setSalesForm((prev) => ({ ...prev, salaryMax: nextMax }));
    } else {
      setTechForm((prev) => ({ ...prev, salaryMax: nextMax }));
    }
  };

  const applyRelaxAuxiliary = () => {
    if (isSales) {
      setSalesForm((prev) => ({
        ...prev,
        industryHardMode: 'off',
        driverLicenses: [],
        travelAbility: '',
      }));
    } else {
      setTechForm((prev) => ({
        ...prev,
        autonomyLevel: prev.autonomyLevel && prev.autonomyLevel > 2 ? prev.autonomyLevel - 1 : prev.autonomyLevel,
        driverLicenses: [],
        shiftFlexibility: '',
      }));
    }
  };

  const reviseMutation = useMutation({
    mutationFn: async () => {
      if (!jobId || !engagementId) throw new Error('Chưa có JD gắn với Tin Săn này');
      if (isSales) {
        const { publish: _publish, ...payload } = formToCreateJobRequest(salesForm, false);
        await updateJob(jobId, { ...payload, fromSourcingRevision: true });
      } else {
        const { publish: _publish, ...payload } = formToCreateTechnicalJobRequest(techForm, false);
        await updateJob(jobId, { ...payload, fromSourcingRevision: true });
      }
      const changeSummary =
        diffItems.length > 0
          ? diffItems.join('; ')
          : 'Cập nhật mô tả & tối ưu trọng số tiêu chí JD';
      const updatedWs = await consumeRecruiterSourcing({
        kind: 'revision',
        engagementId,
        jobId,
        note: `Điều chỉnh Tin Săn «${isSales ? salesForm.title : techForm.title}»: ${changeSummary}`,
      });
      return { updatedWs, changeSummary };
    },
    onSuccess: ({ updatedWs, changeSummary }) => {
      setErrText(null);
      setConfirmDiscardOpen(false);
      setInitialSales(salesForm);
      setInitialTech(techForm);
      // Tự động đóng popup ngay lập tức khi NTD bấm Lưu thành công
      onClose();
      onWorkspaceUpdated(
        updatedWs,
        `Đã áp dụng điều chỉnh (${changeSummary}) và đang cập nhật đợt quét ứng viên mới!`,
      );
      void qc.invalidateQueries({ queryKey: ['job', jobId] });
      void qc.invalidateQueries({ queryKey: ['my-jobs'] });
      if (jobId) {
        void sourcingCandidatesForJob(jobId, true).then(() => {
          void qc.invalidateQueries({ queryKey: ['sourcing-hunt', jobId] });
          void qc.invalidateQueries({ queryKey: ['recruiter-sourcing'] });
        });
      }
    },
    onError: (err) => {
      setErrText(err instanceof ApiError ? err.message : 'Không lưu được điều chỉnh tiêu chí JD');
    },
  });

  if (!open) return null;

  const outOfRevisions = revisionsRemaining !== null && revisionsRemaining <= 0;
  const lockedDisabled = reviseMutation.isPending || outOfRevisions;
  const fixedTitle = isSales ? salesForm.title : techForm.position || techForm.title;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-3 backdrop-blur-xs sm:p-5"
      onClick={handleRequestClose}
    >
      {/* Khung Modal bo tròn 4 góc đều nhau (overflow-hidden giữ bo góc không bị thanh cuộn cắt mất) */}
      <div
        className="relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[#d7e3f2] bg-white shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        {/* HEADER CỐ ĐỊNH + NÚT X GÓC PHẢI DỄ BẤM */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200/80 bg-white px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#E8872A] ring-1 ring-amber-200">
                <Sparkles className="h-3 w-3" />
                Tối ưu tiêu chí tuyển dụng
              </span>
              <span className="inline-flex items-center rounded-full bg-[#072348] px-2.5 py-0.5 text-[10px] font-bold text-white">
                Còn {revisionsRemaining ?? '∞'} lượt điều chỉnh
              </span>
            </div>
            <h3 className="mt-1.5 text-lg font-extrabold text-[#072348] sm:text-xl">
              Điều chỉnh tiêu chí Tin Săn
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Chọn gợi ý tối ưu từ AI hoặc chỉnh sửa trực tiếp các nhóm tiêu chí tuyển dụng bên dưới — hệ thống tự động
              ghi nhận lịch sử và quét lại ứng viên ngay.
            </p>
          </div>

          <button
            type="button"
            onClick={handleRequestClose}
            title="Đóng cửa sổ điều chỉnh"
            aria-label="Đóng cửa sổ điều chỉnh"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* NỘI DUNG CUỘN BÊN TRONG */}
        {!jobId ? (
          <div className="p-6">
            <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
              Tin Săn này chưa gắn JD. Hãy tạo hoặc gắn JD trước khi điều chỉnh tiêu chí.
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-[#E8872A]" /> Đang tải tiêu chí JD hiện tại...
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto bg-[#f4f7fb]/60 px-5 py-4 sm:px-6 sm:py-5">
            {/* Banner Khóa Vị Trí Gốc */}
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#d7e3f2] bg-white px-4 py-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#072348] text-white">
                  <Lock className="h-4 w-4" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">Vị trí săn cố định:</span>
                    <span className="text-sm font-extrabold text-[#072348]">{fixedTitle || job?.title}</span>
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-[#E8872A] ring-1 ring-amber-200/80">
                      {isSales ? 'Khối Kinh doanh B2B' : 'Khối Kỹ thuật & Công nghiệp'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Chức danh gốc được khóa cố định theo quy định gói Săn 01 vị trí để bảo toàn phễu ứng viên.
                  </p>
                </div>
              </div>
            </div>

            {/* PHẦN 1: ĐỀ XUẤT ĐIỀU CHỈNH TỰ ĐỘNG TỪ AI INLINK (1-CLICK ÁP DỤNG) */}
            <div className="rounded-2xl border border-amber-200/90 bg-white p-4 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-[#072348] sm:text-sm">
                  <Sparkles className="h-4 w-4 text-[#E8872A]" />
                  Gợi ý tối ưu tiêu chí từ AI inlink
                </h4>
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-200">
                  {aiDiagnostics.highCount} UV khớp ≥80% · {aiDiagnostics.medCount} UV tiệm cận 60–79%
                </span>
              </div>
              {aiDiagnostics.topMissing.length > 0 ? (
                <p className="mt-1 text-xs text-slate-600">
                  Điểm nghẽn tiêu chí phổ biến nhất:{' '}
                  <span className="font-semibold text-[#072348]">{aiDiagnostics.topMissing.join(' · ')}</span>
                </p>
              ) : null}

              <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                {/* Gợi ý 1: Nới kinh nghiệm */}
                <div className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-[#f8fafc] p-3">
                  <div>
                    <p className="text-xs font-bold text-[#072348]">1. Nới bậc kinh nghiệm (-1 bậc)</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                      Hạ yêu cầu từ{' '}
                      <span className="font-semibold text-slate-800">
                        {currentExp ? EXPERIENCE_LABEL[currentExp] : 'Mức hiện tại'}
                      </span>{' '}
                      xuống{' '}
                      <span className="font-semibold text-[#E8872A]">
                        {relaxedExp ? EXPERIENCE_LABEL[relaxedExp] : EXPERIENCE_LABEL[ExperienceBand.From1To3]}
                      </span>{' '}
                      để đẩy nhóm UV 65–79% lên ngưỡng ≥80%.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={lockedDisabled || currentExp === ExperienceBand.None}
                    onClick={applyRelaxExperience}
                    className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#072348] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#0b3162] disabled:opacity-40"
                  >
                    <Sparkles className="h-3 w-3 text-[#E8872A]" />
                    {currentExp === ExperienceBand.None ? 'Đã mở rộng tối đa' : 'Áp dụng nới kinh nghiệm'}
                  </button>
                </div>

                {/* Gợi ý 2: Nâng trần ngân sách lương +20% */}
                <div className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-[#f8fafc] p-3">
                  <div>
                    <p className="text-xs font-bold text-[#072348]">2. Nâng trần ngân sách (+20%)</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                      Nâng trần lương tối đa lên{' '}
                      <span className="font-semibold text-[#E8872A]">{formatVndAmount(boostedSalaryMax)}</span> để thu
                      hút nhóm ứng viên Senior/Key Account.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={lockedDisabled}
                    onClick={applyBoostSalary}
                    className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#072348] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#0b3162] disabled:opacity-40"
                  >
                    <TrendingUp className="h-3 w-3 text-[#E8872A]" />
                    Áp dụng nâng trần +20%
                  </button>
                </div>

                {/* Gợi ý 3: Nới lọc cứng & điều kiện phụ */}
                <div className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-[#f8fafc] p-3">
                  <div>
                    <p className="text-xs font-bold text-[#072348]">3. Mở rộng ngành & điều kiện phụ</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
                      {isSales
                        ? 'Tắt lọc cứng ngành tuyệt đối và gỡ yêu cầu bắt buộc bằng lái/công tác để mở rộng tệp B2B.'
                        : 'Giảm 1 bậc tự chủ yêu cầu và gỡ điều kiện bắt buộc bằng lái/ca kíp để mở rộng tệp kỹ sư.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={lockedDisabled}
                    onClick={applyRelaxAuxiliary}
                    className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#072348] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#0b3162] disabled:opacity-40"
                  >
                    <RefreshCw className="h-3 w-3 text-[#E8872A]" />
                    Áp dụng mở rộng tệp săn
                  </button>
                </div>
              </div>
            </div>

            {/* TIÊU CHÍ TUYỂN DỤNG TRỌNG TÂM */}
            <fieldset disabled={lockedDisabled} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-1 px-0.5">
                <h4 className="text-xs font-extrabold uppercase tracking-wide text-[#072348] sm:text-sm">
                  Tiêu chí tuyển dụng & Độ phủ ứng viên
                </h4>
                <span className="text-[11px] text-slate-500">
                  Chỉnh sửa trực tiếp các tiêu chí quyết định độ phù hợp hồ sơ
                </span>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {/* MỨC THU NHẬP & NGÂN SÁCH LƯƠNG */}
                <div className="rounded-2xl border border-[#d7e3f2] bg-white p-4 shadow-2xs">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-[#072348]">
                    Mức thu nhập & Ngân sách lương (VNĐ/tháng)
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Quyết định trực tiếp điểm khớp thu nhập kỳ vọng của ứng viên.
                  </p>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600">Lương tối thiểu</label>
                      <MoneyInput
                        value={isSales ? salesForm.salaryMin : techForm.salaryMin}
                        onChange={(salaryMin) =>
                          isSales
                            ? setSalesForm((p) => ({ ...p, salaryMin }))
                            : setTechForm((p) => ({ ...p, salaryMin }))
                        }
                        placeholder="VD: 15.000.000"
                        size="sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-600">Trần ngân sách tối đa</label>
                      <MoneyInput
                        value={isSales ? salesForm.salaryMax : techForm.salaryMax}
                        onChange={(salaryMax) =>
                          isSales
                            ? setSalesForm((p) => ({ ...p, salaryMax }))
                            : setTechForm((p) => ({ ...p, salaryMax }))
                        }
                        placeholder="VD: 25.000.000"
                        size="sm"
                      />
                    </div>
                  </div>
                </div>

                {/* CẤP BẬC & KINH NGHIỆM YÊU CẦU */}
                <div className="rounded-2xl border border-[#d7e3f2] bg-white p-4 shadow-2xs">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-[#072348]">
                    Cấp bậc & Kinh nghiệm yêu cầu
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Điều chỉnh độ mở về thâm niên để cân bằng giữa chất lượng và độ rộng tệp hồ sơ.
                  </p>
                  <div className="mt-3 space-y-2">
                    <Select
                      value={isSales ? salesForm.jobLevel : techForm.jobLevel}
                      onChange={(e) => {
                        const jobLevel = e.target.value as JobLevelCode | '';
                        if (isSales) setSalesForm((p) => ({ ...p, jobLevel }));
                        else setTechForm((p) => ({ ...p, jobLevel }));
                      }}
                      size="sm"
                    >
                      <option value="">— Chọn cấp bậc —</option>
                      {(isSales
                        ? SALES_JOB_LEVELS
                        : allowedTechnicalLevelsForPosition(techForm.position)
                      ).map((code) => (
                        <option key={code} value={code}>
                          {JOB_LEVEL_LABEL[code]}
                        </option>
                      ))}
                    </Select>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.values(ExperienceBand).map((band) => {
                        const active = (isSales ? salesForm.experienceBand : techForm.experienceBand) === band;
                        return (
                          <button
                            key={band}
                            type="button"
                            onClick={() =>
                              isSales
                                ? setSalesForm((p) => ({ ...p, experienceBand: band }))
                                : setTechForm((p) => ({ ...p, experienceBand: band }))
                            }
                            className={clsx(
                              'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition',
                              active
                                ? 'border-[#072348] bg-[#072348] text-white'
                                : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white',
                            )}
                          >
                            {EXPERIENCE_LABEL[band]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* KHU VỰC LÀM VIỆC & THỊ TRƯỜNG PHỤ TRÁCH */}
                <div className="rounded-2xl border border-[#d7e3f2] bg-white p-4 shadow-2xs">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-[#072348]">
                    Khu vực làm việc & Địa bàn phụ trách
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Thêm các tỉnh/KCN lân cận để bắt trọn ứng viên sẵn sàng di chuyển hoặc phụ trách vùng.
                  </p>
                  <div className="mt-3 space-y-2.5">
                    <LocationPicker
                      variant="field"
                      multiple
                      placeholder="Chọn tỉnh / thành phố / KCN..."
                      value={parseJoinedLocations(isSales ? salesForm.location : techForm.location)}
                      onChange={(labels) => {
                        const location = joinLocationLabels(labels);
                        if (isSales) setSalesForm((p) => ({ ...p, location }));
                        else setTechForm((p) => ({ ...p, location }));
                      }}
                    />
                    {isSales ? (
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-slate-600">Thị trường phụ trách:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {MARKET_REGIONS.map((m) => {
                            const active = salesForm.marketsCovered.includes(m);
                            return (
                              <button
                                key={m}
                                type="button"
                                onClick={() =>
                                  setSalesForm((p) => ({
                                    ...p,
                                    marketsCovered: toggleArrayItem(p.marketsCovered, m),
                                  }))
                                }
                                className={clsx(
                                  'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition',
                                  active
                                    ? 'border-[#072348] bg-[#072348] text-white'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white',
                                )}
                              >
                                {m}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-slate-600">Môi trường làm việc:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {WORK_ENVIRONMENT_OPTIONS.map((env) => {
                            const active = techForm.workEnvironments.includes(env);
                            return (
                              <button
                                key={env}
                                type="button"
                                onClick={() =>
                                  setTechForm((p) => ({
                                    ...p,
                                    workEnvironments: toggleArrayItem(p.workEnvironments, env),
                                  }))
                                }
                                className={clsx(
                                  'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition',
                                  active
                                    ? 'border-[#072348] bg-[#072348] text-white'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white',
                                )}
                              >
                                {env}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* TIÊU CHÍ CHUYÊN MÔN TRỌNG TÂM */}
                <div className="rounded-2xl border border-[#d7e3f2] bg-white p-4 shadow-2xs">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-[#072348]">
                    Yêu cầu chuyên môn trọng tâm
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {isSales
                      ? 'Chế độ lọc ngành, tệp khách hàng mục tiêu và mô hình bán hàng.'
                      : 'Mức độ tự chủ công việc (1–5) và nhóm nghiệp vụ kỹ thuật.'}
                  </p>
                  {isSales ? (
                    <div className="mt-3 space-y-2.5">
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-slate-600">Chế độ lọc cứng ngành:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(
                            [
                              ['off', 'Không lọc cứng (Mở rộng)'],
                              ['near', 'Ngành gần (≥85%)'],
                              ['exact', 'Đúng ngành (100%)'],
                            ] as const
                          ).map(([val, label]) => (
                            <button
                              key={val}
                              type="button"
                              onClick={() => setSalesForm((p) => ({ ...p, industryHardMode: val }))}
                              className={clsx(
                                'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition',
                                salesForm.industryHardMode === val
                                  ? 'border-[#072348] bg-[#072348] text-white'
                                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white',
                              )}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-slate-600">Tệp khách hàng B2B:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {CUSTOMER_SEGMENTS.map((seg) => {
                            const active = salesForm.customerSegments.includes(seg);
                            return (
                              <button
                                key={seg}
                                type="button"
                                onClick={() =>
                                  setSalesForm((p) => ({
                                    ...p,
                                    customerSegments: toggleArrayItem(p.customerSegments, seg),
                                  }))
                                }
                                className={clsx(
                                  'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition',
                                  active
                                    ? 'border-[#E8872A] bg-amber-50 font-bold text-[#072348]'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white',
                                )}
                              >
                                {seg}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-slate-600">Loại hình bán hàng:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {DEAL_TYPE_OPTIONS.map((dt) => {
                            const active = salesForm.dealTypes.includes(dt);
                            return (
                              <button
                                key={dt}
                                type="button"
                                onClick={() =>
                                  setSalesForm((p) => ({
                                    ...p,
                                    dealTypes: toggleArrayItem(p.dealTypes, dt),
                                  }))
                                }
                                className={clsx(
                                  'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition',
                                  active
                                    ? 'border-[#072348] bg-[#072348] text-white'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white',
                                )}
                              >
                                {DEAL_TYPE_LABEL[dt]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2.5">
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-slate-600">Mức độ tự chủ kỹ thuật (1–5):</p>
                        <div className="flex flex-wrap gap-1.5">
                          {JD_TECHNICAL_AUTONOMY_OPTIONS.map((opt) => {
                            const active = techForm.autonomyLevel === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setTechForm((p) => ({ ...p, autonomyLevel: opt.value }))}
                                className={clsx(
                                  'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition',
                                  active
                                    ? 'border-[#072348] bg-[#072348] text-white'
                                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white',
                                )}
                              >
                                {opt.value}. {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-slate-600">Nhóm công việc kỹ thuật:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {TECHNICAL_WORK_TYPES.map((wt) => {
                            const active = techForm.technicalWorkTypes.includes(wt);
                            return (
                              <button
                                key={wt}
                                type="button"
                                onClick={() =>
                                  setTechForm((p) => ({
                                    ...p,
                                    technicalWorkTypes: toggleArrayItem(p.technicalWorkTypes, wt),
                                  }))
                                }
                                className={clsx(
                                  'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition',
                                  active
                                    ? 'border-[#E8872A] bg-amber-50 font-bold text-[#072348]'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white',
                                )}
                              >
                                {wt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ĐIỀU KIỆN BỔ TRỢ */}
              <div className="rounded-2xl border border-[#d7e3f2] bg-white p-4 shadow-2xs">
                <p className="text-xs font-extrabold uppercase tracking-wide text-[#072348]">
                  Điều kiện bổ trợ (Ngoại ngữ · Giấy phép lái xe · Công tác)
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Bỏ bớt các điều kiện phụ không thực sự bắt buộc sẽ giúp tăng đáng kể điểm tổng cho ứng viên giỏi
                  chuyên môn.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-slate-600">Ngoại ngữ:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {LANGUAGE_OPTIONS.map((lang) => {
                        const list = isSales ? salesForm.languages : techForm.languages;
                        const active = list.includes(lang);
                        return (
                          <button
                            key={lang}
                            type="button"
                            onClick={() =>
                              isSales
                                ? setSalesForm((p) => ({ ...p, languages: toggleArrayItem(p.languages, lang) }))
                                : setTechForm((p) => ({ ...p, languages: toggleArrayItem(p.languages, lang) }))
                            }
                            className={clsx(
                              'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition',
                              active
                                ? 'border-[#072348] bg-[#072348] text-white'
                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white',
                            )}
                          >
                            {lang}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-slate-600">Giấy phép lái xe:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {DRIVER_LICENSE_TYPES.map((lic) => {
                        const list = isSales ? salesForm.driverLicenses : techForm.driverLicenses;
                        const active = list.includes(lic);
                        return (
                          <button
                            key={lic}
                            type="button"
                            onClick={() =>
                              isSales
                                ? setSalesForm((p) => ({
                                    ...p,
                                    driverLicenses: toggleArrayItem(p.driverLicenses, lic),
                                  }))
                                : setTechForm((p) => ({
                                    ...p,
                                    driverLicenses: toggleArrayItem(p.driverLicenses, lic),
                                  }))
                            }
                            className={clsx(
                              'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition',
                              active
                                ? 'border-[#072348] bg-[#072348] text-white'
                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white',
                            )}
                          >
                            {lic}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-slate-600">Khả năng đi công tác:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.values(TravelAbility).map((tr) => {
                        const current = isSales ? salesForm.travelAbility : techForm.travelAbility;
                        const active = current === tr;
                        return (
                          <button
                            key={tr}
                            type="button"
                            onClick={() =>
                              isSales
                                ? setSalesForm((p) => ({ ...p, travelAbility: active ? '' : tr }))
                                : setTechForm((p) => ({ ...p, travelAbility: active ? '' : tr }))
                            }
                            className={clsx(
                              'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition',
                              active
                                ? 'border-[#072348] bg-[#072348] text-white'
                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white',
                            )}
                          >
                            {TRAVEL_ABILITY_LABEL[tr]}
                          </button>
                        );
                      })}
                    </div>
                    {!isSales ? (
                      <div className="mt-2">
                        <p className="mb-1 text-[11px] font-semibold text-slate-600">Làm ca / ngoài giờ:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {JD_TECHNICAL_SHIFT_OPTIONS.map((sh) => {
                            const active = techForm.shiftFlexibility === sh.value;
                            return (
                              <button
                                key={sh.value}
                                type="button"
                                onClick={() =>
                                  setTechForm((p) => ({ ...p, shiftFlexibility: active ? '' : sh.value }))
                                }
                                className={clsx(
                                  'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition',
                                  active
                                    ? 'border-[#072348] bg-[#072348] text-white'
                                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white',
                                )}
                              >
                                {sh.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </fieldset>

            {/* Nút mở rộng chỉnh sửa toàn bộ JD chi tiết (vẫn khóa Vị trí tuyển dụng) */}
            <div className="rounded-2xl border border-[#d7e3f2] bg-white p-4 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-[#072348]">
                    Chỉnh sửa nâng cao: Danh mục Sản phẩm/Thiết bị & Nội dung mô tả JD
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Mở biểu mẫu đầy đủ nếu muốn cập nhật thêm thiết bị/sản phẩm, chứng chỉ hoặc mô tả công việc (Vị trí
                    gốc vẫn khóa cố định).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFullJd((v) => !v)}
                  className="rounded-xl border border-[#072348]/20 bg-[#f4f7fb] px-3 py-1.5 text-xs font-bold text-[#072348] transition hover:bg-[#072348] hover:text-white"
                >
                  {showFullJd ? 'Thu gọn biểu mẫu đầy đủ' : 'Mở biểu mẫu JD chi tiết'}
                </button>
              </div>
              {showFullJd ? (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  {isSales ? (
                    <JdSalesForm
                      form={salesForm}
                      lockPosition
                      onChange={(partial) => setSalesForm((prev) => ({ ...prev, ...partial }))}
                      uncertainKeys={[]}
                      disabled={lockedDisabled}
                    />
                  ) : (
                    <JdTechnicalForm
                      form={techForm}
                      lockPosition
                      onChange={(partial) => setTechForm((prev) => ({ ...prev, ...partial }))}
                      uncertainKeys={[]}
                      disabled={lockedDisabled}
                    />
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* FOOTER CỐ ĐỊNH GỌN GÀNG + NHẬT KÝ THAY ĐỔI */}
        {jobId && !isLoading ? (
          <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3.5 sm:px-6">
            {errText ? (
              <p className="mb-2.5 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {errText}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                {diffItems.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-[#072348]">Thay đổi chờ áp dụng:</span>
                    {diffItems.map((item, idx) => (
                      <span
                        key={idx}
                        className="rounded-lg bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-[#072348] ring-1 ring-amber-200"
                      >
                        ✓ {item}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Chưa có thay đổi nào so với JD hiện tại. Bạn có thể chọn gợi ý tối ưu hoặc chỉnh sửa các tiêu chí ở
                    trên.
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2.5">
                <Button type="button" variant="outline" onClick={handleRequestClose}>
                  Hủy
                </Button>
                <Button
                  type="button"
                  disabled={lockedDisabled}
                  onClick={() => reviseMutation.mutate()}
                >
                  {reviseMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Lưu điều chỉnh & Quét lại ngay (-1 lượt)
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* HỘP THOẠI XÁC NHẬN KHI BẤM X / HUỶ MÀ CHƯA LƯU ĐIỀU CHỈNH */}
        {confirmDiscardOpen ? (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-[#E8872A]">
                  <AlertCircle className="h-5 w-5" />
                </span>
                <div>
                  <h4 className="text-base font-extrabold text-[#072348]">
                    Điều chỉnh chưa được áp dụng
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Bạn đã thay đổi tiêu chí săn nhưng chưa bấm lưu áp dụng. Bạn có muốn huỷ các điều chỉnh vừa thực
                    hiện không?
                  </p>
                  {diffItems.length > 0 ? (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {diffItems.map((item, i) => (
                        <span
                          key={i}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDiscardOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Tiếp tục điều chỉnh
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDiscard}
                  className="rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-rose-700"
                >
                  Có, huỷ điều chỉnh
                </button>
              </div>
            </div>
          </div>
        ) : null}
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
  const [expandedExp, setExpandedExp] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const isOpen = Boolean(candidateRow);
    window.dispatchEvent(new CustomEvent('inlink-candidate-drawer', { detail: { open: isOpen } }));
    return () => {
      window.dispatchEvent(new CustomEvent('inlink-candidate-drawer', { detail: { open: false } }));
    };
  }, [candidateRow]);

  useEffect(() => {
    if (!candidateRow) return;
    setUnlocked(Boolean(candidateRow.viewed || candidateRow.applied));
    setConnectMessage(
      `Chào ${candidateRow.displayName}, công ty chúng tôi đang tuyển vị trí «${engagementTitle}» rất phù hợp với kinh nghiệm của bạn trên inlink. Mong được kết nối trao đổi thêm cùng bạn!`,
    );
    setShowInterviewForm(false);
    setExpandedExp(false);
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

  const rawScore = candidateRow.match.score <= 1 ? candidateRow.match.score * 100 : candidateRow.match.score;
  const clampedPct = Math.max(0, Math.min(100, rawScore));
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
                  <span className="rounded-full bg-indigo-400/25 px-2.5 py-0.5 text-[10px] font-bold text-indigo-100 ring-1 ring-indigo-300/40">
                    ★ Đã Shortlist
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
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowInterviewForm((v) => !v)}
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

          {/* Mở khóa hồ sơ & Liên hệ / Kết nối ứng viên */}
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
  );
}
