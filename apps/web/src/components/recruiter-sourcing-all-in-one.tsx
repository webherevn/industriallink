'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Calendar,
  CheckCircle2,
  Download,
  ExternalLink,
  FileBarChart2,
  Headphones,
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
import { useEffect, useMemo, useRef, useState } from 'react';
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
  SOURCING_OUTREACH_STATUS_META,
  TECHNICAL_WORK_TYPES,
  TRAVEL_ABILITY_LABEL,
  TravelAbility,
  WORK_ENVIRONMENT_OPTIONS,
  allowedTechnicalLevelsForPosition,
  formatJobLevel,
  formatJobTitle,
  type CandidateMatchView,
  type RecruiterSourcingEntitlements,
  type RecruiterSourcingOutreachItem,
  type RecruiterSourcingReportView,
  type RecruiterSourcingScanRoundView,
  type RecruiterSourcingWorkspace,
  type SourcingOutreachStatus,
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
  removeCandidateShortlist,
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
// 1. MODAL BÁO CÁO TIẾN ĐỘ & KHUYẾN NGHỊ AI (TRÌNH QUẢN LÝ / BAN GIÁM ĐỐC)
// ============================================================================

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function csvCell(val: string | number | null | undefined): string {
  const s = String(val ?? '').replace(/\r?\n/g, ' ').trim();
  if (s.includes(',') || s.includes('"') || s.includes(';')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

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

  const { data: job } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => getJob(jobId!),
    enabled: Boolean(open && jobId),
  });

  const analytics = useMemo(() => {
    const normPct = (s: number) => (s <= 1 ? s * 100 : s);
    const totalMatched = allResults.length;
    const highMatch = allResults.filter((r) => normPct(r.match.score) >= 80);
    const mediumMatch = allResults.filter((r) => {
      const pct = normPct(r.match.score);
      return pct >= 60 && pct < 80;
    });
    const lowMatch = allResults.filter((r) => normPct(r.match.score) < 60);
    const opened = allResults.filter((r) => r.viewed || r.applied);
    const applied = allResults.filter((r) => r.applied);
    const unviewedHigh = highMatch.filter((r) => !r.viewed && !r.applied);

    const scores = allResults.map((r) => normPct(r.match.score));
    const avgScore =
      scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
    const maxScore = scores.length > 0 ? Math.round(Math.max(...scores) * 10) / 10 : 0;

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
      .slice(0, 5);
    const topStrengths = [...matchedFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const bottlenecks: string[] = [];
    if (topMissing.length > 0) {
      bottlenecks.push(
        `Rào cản tiêu chí khiến nhiều ứng viên chưa đạt điểm tối đa: ${topMissing
          .map(([label, cnt]) => `${label} (${cnt}/${totalMatched} hồ sơ, chiếm ${Math.round((cnt / Math.max(1, totalMatched)) * 100)}%)`)
          .join('; ')}.`,
      );
    } else if (totalMatched === 0) {
      bottlenecks.push(
        'Hiện tại bộ tiêu chí JD đang khá hẹp so với nguồn cung thị trường nên chưa có hồ sơ đạt ngưỡng khớp. Đề xuất mở rộng ngành hàng tương đương hoặc khu vực lân cận.',
      );
    } else {
      bottlenecks.push(
        'Bộ tiêu chí JD hiện tại có độ tương thích tốt với mặt bằng ứng viên trên thị trường.',
      );
    }

    if (topStrengths.length > 0) {
      bottlenecks.push(
        `Năng lực đáp ứng tốt nhất của tệp ứng viên hiện tại: ${topStrengths
          .map(([label, cnt]) => `${label} (${cnt} hồ sơ)`)
          .join('; ')}.`,
      );
    }

    const recommendations: string[] = [];
    if (shortlistedIds.length > 0) {
      recommendations.push(
        `Trình Quản lý / Trưởng bộ phận phê duyệt phỏng vấn ngay ${shortlistedIds.length} ứng viên trong danh sách Rút gọn (Shortlist) đang có mức độ phù hợp cao nhất.`,
      );
    } else if (totalMatched > 0) {
      recommendations.push(
        `Thực hiện rà soát và chọn ra 3–5 ứng viên sáng giá nhất đưa vào danh sách Shortlist (còn ${
          entitlements.shortlistsRemaining ?? '∞'
        } lượt) để trình Quản lý duyệt lịch phỏng vấn.`,
      );
    }
    if (unviewedHigh.length > 0) {
      recommendations.push(
        `Mở thẩm định ngay ${unviewedHigh.length} hồ sơ đạt độ khớp rất cao (≥ 80%) chưa xem bằng Credit trong gói Săn để chủ động liên hệ trước đối thủ tuyển dụng.`,
      );
    }
    if (highMatch.length < 3 && (entitlements.revisionsRemaining ?? 0) > 0) {
      recommendations.push(
        `Số lượng ứng viên đạt ngưỡng ≥ 80% hiện mới có ${highMatch.length} hồ sơ. Đề xuất Ban Giám đốc duyệt phương án điều chỉnh nhẹ tiêu chí phụ (còn ${entitlements.revisionsRemaining} lượt điều chỉnh JD) hoặc nới biên độ lương để mở rộng nguồn ứng viên chất lượng.`,
      );
    } else {
      recommendations.push(
        'Duy trì cơ chế quét AI tự động 2 giờ/lần (08:00–18:00) để tiếp tục bổ sung ứng viên mới vào phễu tuyển dụng hàng ngày.',
      );
    }

    const prioritizedCandidates = [...allResults]
      .sort((a, b) => {
        const aSl = shortlistedIds.includes(a.candidateId) ? 1 : 0;
        const bSl = shortlistedIds.includes(b.candidateId) ? 1 : 0;
        if (bSl !== aSl) return bSl - aSl;
        const aApp = a.applied ? 1 : 0;
        const bApp = b.applied ? 1 : 0;
        if (bApp !== aApp) return bApp - aApp;
        return normPct(b.match.score) - normPct(a.match.score);
      });

    const healthStatus =
      shortlistedIds.length >= 2 || highMatch.length >= 2 || applied.length >= 2
        ? {
            label: 'Khả quan · Có ứng viên sáng giá trình phỏng vấn',
            tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
            printColor: '#047857',
          }
        : totalMatched > 0
          ? {
              label: 'Đang triển khai · Cần thẩm định & chốt Shortlist',
              tone: 'bg-amber-50 text-amber-800 ring-amber-200',
              printColor: '#b45309',
            }
          : {
              label: 'Nguồn cung hẹp · Cần tối ưu tiêu chí JD',
              tone: 'bg-rose-50 text-rose-700 ring-rose-200',
              printColor: '#be123c',
            };

    return {
      totalScanned: Math.max(totalMatched * 4, scanRounds.length * 12, totalMatched),
      totalMatched,
      highMatchCount: highMatch.length,
      mediumMatchCount: mediumMatch.length,
      lowMatchCount: lowMatch.length,
      openedCount: opened.length,
      shortlistedCount: shortlistedIds.length,
      appliedCount: applied.length,
      avgScore,
      maxScore,
      topMissing,
      topStrengths,
      bottlenecks,
      recommendations,
      prioritizedCandidates,
      healthStatus,
    };
  }, [allResults, scanRounds.length, shortlistedIds, entitlements]);

  const jobSummary = useMemo(() => {
    const titleText = job?.title ? formatJobTitle(job.title) : engagementTitle || 'Vị trí Săn nhân sự';
    const locationText = job?.location || 'Theo tiêu chí JD';
    const salaryText =
      job?.salaryMin || job?.salaryMax
        ? `${job?.salaryMin ? formatVndAmount(job.salaryMin) : 'Thoả thuận'} – ${
            job?.salaryMax ? formatVndAmount(job.salaryMax) : 'Thoả thuận'
          }`
        : 'Thoả thuận theo năng lực';
    const levelText = job?.jobLevel ? formatJobLevel(job.jobLevel) : 'Chuyên viên / Quản lý';
    const expText =
      job?.experienceBand && EXPERIENCE_LABEL[job.experienceBand as ExperienceBand]
        ? EXPERIENCE_LABEL[job.experienceBand as ExperienceBand]
        : 'Theo yêu cầu JD';
    return { titleText, locationText, salaryText, levelText, expText };
  }, [job, engagementTitle]);

  const handleExportCsv = () => {
    const nowStr = new Date().toLocaleDateString('vi-VN');
    const lines: string[][] = [
      ['BÁO CÁO TIẾN ĐỘ TUYỂN DỤNG & SĂN NHÂN SỰ (TRÌNH QUẢN LÝ / BAN GIÁM ĐỐC)'],
      ['Vị trí tuyển dụng', jobSummary.titleText],
      ['Khu vực làm việc', jobSummary.locationText],
      ['Ngân sách lương', jobSummary.salaryText],
      ['Cấp bậc & Kinh nghiệm', `${jobSummary.levelText} · ${jobSummary.expText}`],
      ['Gói dịch vụ', entitlements.planName ?? 'Gói Săn nhân sự'],
      ['Ngày xuất báo cáo', nowStr],
      ['Đánh giá chung', analytics.healthStatus.label],
      [],
      ['I. THỐNG KÊ PHỄU CHUYỂN ĐỔI TUYỂN DỤNG'],
      ['Chỉ số đo lường', 'Số lượng', 'Tỷ lệ / Ghi chú'],
      ['1. Tổng hồ sơ hệ thống AI đã rà soát', String(analytics.totalScanned), `${scanRounds.length} đợt quét tự động 2h/lần`],
      ['2. Tổng ứng viên khớp tiêu chí JD', String(analytics.totalMatched), `Điểm khớp TB: ${analytics.avgScore}% · Cao nhất: ${analytics.maxScore}%`],
      ['   - Ứng viên khớp rất cao (≥ 80%)', String(analytics.highMatchCount), `${Math.round((analytics.highMatchCount / Math.max(1, analytics.totalMatched)) * 100)}% tổng hồ sơ khớp`],
      ['   - Ứng viên khớp khá (60% – 79%)', String(analytics.mediumMatchCount), `${Math.round((analytics.mediumMatchCount / Math.max(1, analytics.totalMatched)) * 100)}% tổng hồ sơ khớp`],
      ['   - Ứng viên tiệm cận (< 60%)', String(analytics.lowMatchCount), `${Math.round((analytics.lowMatchCount / Math.max(1, analytics.totalMatched)) * 100)}% tổng hồ sơ khớp`],
      ['3. Hồ sơ HR đã mở thẩm định / liên hệ', String(analytics.openedCount), `${Math.round((analytics.openedCount / Math.max(1, analytics.totalMatched)) * 100)}% trên tổng hồ sơ khớp`],
      ['4. Ứng viên đưa vào Shortlist trình Quản lý', String(analytics.shortlistedCount), `Đã dùng ${entitlements.shortlistsUsed}/${entitlements.shortlistQuota ?? '∞'} hạn mức Shortlist`],
      ['5. Ứng viên chủ động nộp đơn ứng tuyển', String(analytics.appliedCount), 'Ứng viên tự ứng tuyển trực tiếp vào JD'],
      [],
      ['II. PHÂN TÍCH THỊ TRƯỜNG & ĐỀ XUẤT HÀNH ĐỘNG'],
      ...analytics.bottlenecks.map((b, i) => [`Phân tích #${i + 1}`, b]),
      ...analytics.recommendations.map((r, i) => [`Đề xuất #${i + 1}`, r]),
      [],
      ['III. DANH SÁCH CHI TIẾT ỨNG VIÊN TRONG PHỄU TUYỂN DỤNG'],
      [
        'STT',
        'Họ và tên ứng viên',
        'Chức danh hiện tại',
        'Ngành nghề',
        'Khu vực',
        'Tỷ lệ phù hợp (%)',
        'Xếp loại',
        'Trong Shortlist',
        'Nộp đơn ứng tuyển',
        'Trạng thái thẩm định',
        'Điểm mạnh khớp JD',
        'Điểm cần lưu ý / Kiểm tra khi PV',
        'Đánh giá tổng quát',
      ],
      ...analytics.prioritizedCandidates.map((cand, idx) => {
        const pct = formatMatchPct(cand.match.score);
        const num = Number(pct) || 0;
        const tier = num >= 80 ? 'Khớp rất cao (≥80%)' : num >= 60 ? 'Khớp khá (60-79%)' : 'Tiệm cận (<60%)';
        const isSl = shortlistedIds.includes(cand.candidateId);
        return [
          String(idx + 1),
          cand.displayName,
          cand.currentPosition ? formatJobTitle(cand.currentPosition) : 'Chưa cập nhật',
          cand.industry ?? 'Chưa cập nhật',
          cand.location ?? 'Chưa cập nhật',
          `${pct}%`,
          tier,
          isSl ? 'Có (★ Shortlist)' : 'Không',
          cand.applied ? 'Đã ứng tuyển' : 'Ứng viên săn',
          cand.viewed || cand.applied ? 'Đã mở hồ sơ' : 'Chưa mở',
          (cand.match.matchedSkills ?? []).join('; ') || 'Đáp ứng kinh nghiệm chung',
          (cand.match.missingSkills ?? []).join('; ') || 'Không có khoảng thiếu lớn',
          cand.match.reason ?? '',
        ];
      }),
    ];

    const csvContent = '\uFEFF' + lines.map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeSlug = (jobSummary.titleText || 'vi-tri-san')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    link.href = url;
    link.setAttribute('download', `Bao-cao-tuyen-dung-${safeSlug}-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintExecutiveReport = (customReport?: RecruiterSourcingReportView) => {
    const nowStr = new Date().toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const reportTitle = customReport
      ? customReport.title
      : `Báo cáo Tiến độ Tuyển dụng & Săn Nhân sự · Kỳ #${savedReports.length + 1}`;
    const totalScanned = customReport ? customReport.totalScanned : analytics.totalScanned;
    const highCount = customReport ? customReport.highMatchCount : analytics.highMatchCount;
    const medCount = customReport ? customReport.mediumMatchCount : analytics.mediumMatchCount;
    const openedCount = customReport ? customReport.openedCount : analytics.openedCount;
    const slCount = customReport ? customReport.shortlistedCount : analytics.shortlistedCount;
    const appCount = customReport ? customReport.appliedCount : analytics.appliedCount;
    const totalMatched = customReport
      ? Math.max(highCount + medCount, analytics.totalMatched)
      : analytics.totalMatched;
    const bottlenecksList = customReport?.bottlenecks?.length
      ? customReport.bottlenecks
      : analytics.bottlenecks;
    const recsList = customReport?.recommendations?.length
      ? customReport.recommendations
      : analytics.recommendations;

    const topCandidatesRows = analytics.prioritizedCandidates
      .slice(0, 15)
      .map((cand, idx) => {
        const pct = formatMatchPct(cand.match.score);
        const num = Number(pct) || 0;
        const badgeColor = num >= 80 ? '#047857' : num >= 60 ? '#b45309' : '#c2410c';
        const isSl = shortlistedIds.includes(cand.candidateId);
        const statusParts: string[] = [];
        if (isSl) statusParts.push('★ Shortlist trình PV');
        if (cand.applied) statusParts.push('Đã nộp đơn');
        else if (cand.viewed) statusParts.push('Đã thẩm định');
        else statusParts.push('Chờ mở hồ sơ');

        return `
          <tr>
            <td style="text-align:center;font-weight:700;color:#475569;">${idx + 1}</td>
            <td>
              <div style="font-weight:700;color:#072348;font-size:12px;">${escapeHtml(cand.displayName)}</div>
              <div style="font-size:10.5px;color:#64748b;margin-top:2px;">
                ${escapeHtml(cand.currentPosition ? formatJobTitle(cand.currentPosition) : 'Chưa cập nhật vị trí')}
                ${cand.industry ? ` · ${escapeHtml(cand.industry)}` : ''}
              </div>
            </td>
            <td style="font-size:11px;color:#334155;">${escapeHtml(cand.location ?? '—')}</td>
            <td style="text-align:center;">
              <span style="display:inline-block;padding:3px 8px;border-radius:99px;font-weight:800;font-size:11px;color:${badgeColor};background:#f8fafc;border:1px solid ${badgeColor}40;">
                ${pct}%
              </span>
            </td>
            <td style="font-size:10.5px;color:#334155;">
              <div><strong>Điểm mạnh:</strong> ${escapeHtml((cand.match.matchedSkills ?? []).slice(0, 4).join(', ') || 'Đáp ứng kinh nghiệm chung')}</div>
              ${
                (cand.match.missingSkills ?? []).length > 0
                  ? `<div style="color:#b45309;margin-top:2px;"><strong>Lưu ý PV:</strong> ${escapeHtml((cand.match.missingSkills ?? []).slice(0, 3).join(', '))}</div>`
                  : ''
              }
            </td>
            <td style="font-size:10.5px;font-weight:700;color:${isSl ? '#4338ca' : cand.applied ? '#047857' : '#475569'};">
              ${escapeHtml(statusParts.join(' · '))}
            </td>
          </tr>
        `;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(reportTitle)} - ${escapeHtml(jobSummary.titleText)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 14mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #1e293b;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.5;
    }
    .page { max-width: 210mm; margin: 0 auto; padding: 4px 0; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.5px solid #072348;
      padding-bottom: 12px;
      margin-bottom: 14px;
    }
    .brand-tag {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #E8872A;
    }
    .doc-title {
      font-size: 18px;
      font-weight: 800;
      color: #072348;
      margin: 3px 0 2px;
      text-transform: uppercase;
    }
    .doc-sub { font-size: 11.5px; color: #475569; font-weight: 600; }
    .meta-box {
      text-align: right;
      font-size: 10.5px;
      color: #475569;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 7px 11px;
    }
    .section-title {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #072348;
      background: #f1f5f9;
      border-left: 4px solid #E8872A;
      padding: 6px 10px;
      margin: 14px 0 8px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .info-item {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 7px 10px;
      background: #ffffff;
    }
    .info-label { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; }
    .info-val { font-size: 12px; font-weight: 700; color: #072348; margin-top: 2px; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 8px;
      margin-top: 8px;
    }
    .kpi-card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 8px 10px;
      background: #ffffff;
    }
    .kpi-label { font-size: 10px; color: #64748b; font-weight: 600; }
    .kpi-num { font-size: 18px; font-weight: 800; color: #E8872A; margin-top: 2px; }
    .kpi-sub { font-size: 9.5px; color: #64748b; margin-top: 1px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
    }
    th {
      background: #072348;
      color: #ffffff;
      font-size: 10.5px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 6px 8px;
      text-align: left;
      border: 1px solid #072348;
    }
    td {
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      vertical-align: top;
    }
    tr:nth-child(even) td { background: #f8fafc; }
    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .box {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 9px 12px;
      background: #ffffff;
    }
    .box h4 {
      margin: 0 0 6px;
      font-size: 11.5px;
      color: #072348;
      font-weight: 800;
      text-transform: uppercase;
    }
    .box ul { margin: 0; padding-left: 16px; }
    .box li { margin-bottom: 4px; font-size: 11px; color: #334155; }
    .sig-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 18px;
      page-break-inside: avoid;
    }
    .sig-box {
      text-align: center;
      border-top: 1px dashed #cbd5e1;
      padding-top: 8px;
    }
    .sig-title { font-weight: 800; color: #072348; font-size: 11.5px; text-transform: uppercase; }
    .sig-note { font-size: 10px; color: #64748b; font-style: italic; margin-bottom: 48px; }
    @media print {
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="no-print" style="display:flex;justify-content:space-between;align-items:center;background:#072348;color:#fff;padding:10px 16px;border-radius:10px;margin-bottom:14px;">
      <span style="font-size:12px;font-weight:600;">Xem trước Bản In / Xuất PDF chuẩn khổ A4 trình Quản lý & Ban Giám đốc</span>
      <div style="display:flex;gap:8px;">
        <button onclick="window.print()" style="background:#E8872A;color:#fff;border:none;border-radius:8px;padding:6px 14px;font-weight:700;cursor:pointer;font-size:12px;">In / Lưu file PDF</button>
        <button onclick="window.close()" style="background:#ffffff22;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-weight:600;cursor:pointer;font-size:12px;">Đóng</button>
      </div>
    </div>

    <div class="header">
      <div>
        <div class="brand-tag">BÁO CÁO QUẢN TRỊ TUYỂN DỤNG · INLINK HEADHUNTING</div>
        <div class="doc-title">BÁO CÁO TIẾN ĐỘ TUYỂN DỤNG & SĂN NHÂN SỰ</div>
        <div class="doc-sub">Vị trí: ${escapeHtml(jobSummary.titleText)}</div>
      </div>
      <div class="meta-box">
        <div><strong>Kỳ báo cáo:</strong> ${escapeHtml(reportTitle)}</div>
        <div><strong>Ngày xuất:</strong> ${escapeHtml(nowStr)}</div>
        <div><strong>Trạng thái:</strong> <span style="color:${analytics.healthStatus.printColor};font-weight:700;">${escapeHtml(analytics.healthStatus.label)}</span></div>
      </div>
    </div>

    <div class="section-title">I. Thông tin Vị trí Tuyển dụng & Tổng quan Chiến dịch</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Chức danh tuyển dụng (JD)</div>
        <div class="info-val">${escapeHtml(jobSummary.titleText)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Khu vực làm việc</div>
        <div class="info-val">${escapeHtml(jobSummary.locationText)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Ngân sách lương</div>
        <div class="info-val">${escapeHtml(jobSummary.salaryText)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Cấp bậc & Kinh nghiệm</div>
        <div class="info-val">${escapeHtml(jobSummary.levelText)} · ${escapeHtml(jobSummary.expText)}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Gói dịch vụ & Tần suất quét</div>
        <div class="info-val">${escapeHtml(entitlements.planName ?? 'Gói Săn nhân sự')} · ${scanRounds.length} đợt quét (2h/lần)</div>
      </div>
      <div class="info-item">
        <div class="info-label">Điểm phù hợp JD của tệp UV</div>
        <div class="info-val">Trung bình: ${analytics.avgScore}% · Cao nhất: ${analytics.maxScore}%</div>
      </div>
    </div>

    <div class="section-title">II. Phễu Chuyển đổi Săn Nhân sự (Recruitment Funnel)</div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">1. Hồ sơ AI rà soát</div>
        <div class="kpi-num">${totalScanned}</div>
        <div class="kpi-sub">100% nguồn quét</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">2. Đạt ngưỡng khớp JD</div>
        <div class="kpi-num">${totalMatched}</div>
        <div class="kpi-sub">${Math.round((totalMatched / Math.max(1, totalScanned)) * 100)}% qua lọc AI</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">3. Khớp rất cao ≥ 80%</div>
        <div class="kpi-num">${highCount}</div>
        <div class="kpi-sub">Khớp khá 60-79%: ${medCount}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">4. Đã mở thẩm định</div>
        <div class="kpi-num">${openedCount}</div>
        <div class="kpi-sub">${Math.round((openedCount / Math.max(1, totalMatched)) * 100)}% hồ sơ khớp</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">5. Shortlist trình Sếp</div>
        <div class="kpi-num">${slCount}</div>
        <div class="kpi-sub">Ứng viên trọng điểm</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">6. Nộp đơn ứng tuyển</div>
        <div class="kpi-num">${appCount}</div>
        <div class="kpi-sub">Chủ động ứng tuyển</div>
      </div>
    </div>

    <div class="section-title">III. Danh sách Ứng viên Trọng điểm Trình Quản lý / Phỏng vấn</div>
    ${
      analytics.prioritizedCandidates.length === 0
        ? '<p style="font-size:11px;color:#64748b;padding:8px 0;">Chưa có ứng viên đạt ngưỡng khớp trong kỳ báo cáo này.</p>'
        : `
    <table>
      <thead>
        <tr>
          <th style="width:34px;text-align:center;">STT</th>
          <th style="width:24%;">Ứng viên & Vị trí hiện tại</th>
          <th style="width:14%;">Khu vực</th>
          <th style="width:11%;text-align:center;">Độ khớp JD</th>
          <th style="width:33%;">Điểm mạnh đáp ứng JD & Lưu ý phỏng vấn</th>
          <th style="width:14%;">Trạng thái xử lý</th>
        </tr>
      </thead>
      <tbody>
        ${topCandidatesRows}
      </tbody>
    </table>`
    }

    <div class="section-title">IV. Đánh giá Thị trường & Đề xuất Kế hoạch Hành động Tuần tới</div>
    <div class="two-col">
      <div class="box">
        <h4>1. Phân tích Thực tế Tệp Ứng viên & Điểm nghẽn Tiêu chí</h4>
        <ul>
          ${bottlenecksList.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}
        </ul>
      </div>
      <div class="box">
        <h4>2. Đề xuất Kế hoạch Hành động Trình Quản lý Phê duyệt</h4>
        <ul>
          ${recsList.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}
        </ul>
      </div>
    </div>

    <div class="sig-grid">
      <div class="sig-box">
        <div class="sig-title">Người lập báo cáo (Bộ phận Tuyển dụng)</div>
        <div class="sig-note">(Ký và ghi rõ họ tên)</div>
      </div>
      <div class="sig-box">
        <div class="sig-title">Phê duyệt của Quản lý / Ban Giám đốc</div>
        <div class="sig-note">(Ý kiến chỉ đạo & Ký duyệt danh sách phỏng vấn)</div>
      </div>
    </div>
  </div>
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() { window.print(); }, 250);
    });
  </script>
</body>
</html>`;

    const printWin = window.open('', '_blank', 'width=1024,height=860');
    if (!printWin) {
      setErrText('Trình duyệt đang chặn cửa sổ bật lên (Popup). Vui lòng cho phép mở cửa sổ để in / xuất PDF.');
      return;
    }
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
  };

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
      onWorkspaceUpdated(ws, 'Đã chốt & lưu Báo cáo tiến độ tuyển dụng kỳ mới.');
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

  const funnelSteps = [
    {
      step: '1. Tổng hồ sơ hệ thống AI rà soát',
      count: analytics.totalScanned,
      pct: 100,
      note: `${scanRounds.length} đợt quét tự động 2 giờ/lần`,
      barClass: 'bg-slate-700',
    },
    {
      step: '2. Ứng viên đạt ngưỡng khớp JD',
      count: analytics.totalMatched,
      pct: Math.min(100, Math.round((analytics.totalMatched / Math.max(1, analytics.totalScanned)) * 100)),
      note: `Khớp ≥80%: ${analytics.highMatchCount} · Khớp 60–79%: ${analytics.mediumMatchCount} · Tiệm cận: ${analytics.lowMatchCount}`,
      barClass: 'bg-[#072348]',
    },
    {
      step: '3. Hồ sơ HR đã mở thẩm định / liên hệ',
      count: analytics.openedCount,
      pct: Math.min(100, Math.round((analytics.openedCount / Math.max(1, analytics.totalMatched)) * 100)),
      note: `Đã dùng ${entitlements.profileOpensUsed}/${entitlements.creditQuota ?? '∞'} Credit gói Săn`,
      barClass: 'bg-sky-600',
    },
    {
      step: '4. Ứng viên Shortlist trình Quản lý duyệt PV',
      count: analytics.shortlistedCount,
      pct: Math.min(100, Math.round((analytics.shortlistedCount / Math.max(1, analytics.totalMatched)) * 100)),
      note: `Ứng viên trọng điểm đề xuất phỏng vấn`,
      barClass: 'bg-[#E8872A]',
    },
    {
      step: '5. Ứng viên chủ động nộp đơn ứng tuyển',
      count: analytics.appliedCount,
      pct: Math.min(100, Math.round((analytics.appliedCount / Math.max(1, analytics.totalMatched)) * 100)),
      note: `Ứng viên nộp hồ sơ trực tiếp vào JD`,
      barClass: 'bg-emerald-600',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 p-3 backdrop-blur-xs sm:p-5"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-[#d7e3f2] bg-white shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        {/* HEADER BÁO CÁO QUẢN TRỊ */}
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-slate-200/80 bg-[#072348] px-5 py-4 text-white sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#E8872A] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                Báo cáo trình Quản lý / Ban Giám đốc
              </span>
              <span className={clsx('rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1', analytics.healthStatus.tone)}>
                {analytics.healthStatus.label}
              </span>
            </div>
            <h3 className="mt-1.5 text-lg font-extrabold tracking-tight text-white sm:text-xl">
              {jobSummary.titleText}
            </h3>
            <p className="mt-0.5 text-xs text-white/75">
              Gói {entitlements.planName} · Đã chốt {entitlements.searchRoundsUsed}/{entitlements.searchRoundQuota ?? '∞'} kỳ báo cáo · Cập nhật thời gian thực
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-white/20"
              title="Tải file Excel (.csv chuẩn tiếng Việt) gồm phễu số liệu và danh sách ứng viên"
            >
              <Download className="h-3.5 w-3.5 text-[#E8872A]" />
              Xuất Excel (.csv)
            </button>
            <button
              type="button"
              onClick={() => handlePrintExecutiveReport()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#E8872A] px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#d4761d]"
              title="Mở bản báo cáo chuẩn trang A4 để In hoặc Lưu PDF gửi Sếp"
            >
              <Printer className="h-3.5 w-3.5" />
              Xuất PDF / Bản In A4 trình Sếp
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Đóng báo cáo"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white/80 transition hover:bg-rose-500 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* NỘI DUNG BÁO CÁO */}
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTab('live')}
                className={clsx(
                  'rounded-full px-4 py-1.5 text-xs font-bold transition',
                  tab === 'live'
                    ? 'bg-[#072348] text-white shadow-xs'
                    : 'bg-[#f4f7fb] text-slate-600 hover:bg-slate-200/70',
                )}
              >
                Báo cáo Tổng hợp Thời gian thực
              </button>
              <button
                type="button"
                onClick={() => setTab('history')}
                className={clsx(
                  'rounded-full px-4 py-1.5 text-xs font-bold transition',
                  tab === 'history'
                    ? 'bg-[#072348] text-white shadow-xs'
                    : 'bg-[#f4f7fb] text-slate-600 hover:bg-slate-200/70',
                )}
              >
                Lịch sử các kỳ báo cáo đã chốt ({savedReports.length})
              </button>
            </div>
            <span className="text-xs text-slate-500">
              Ngày lập: <strong className="text-slate-700">{new Date().toLocaleDateString('vi-VN')}</strong>
            </span>
          </div>

          {tab === 'live' ? (
            <div className="mt-5 space-y-6">
              {/* PHẦN I: THÔNG TIN VỊ TRÍ & TỔNG QUAN CHIẾN DỊCH */}
              <section className="rounded-2xl border border-slate-200/80 bg-[#f8fafc] p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#072348]">
                    I. Thông tin Vị trí Tuyển dụng & Tổng quan Chiến dịch
                  </h4>
                  <span className="text-xs font-semibold text-slate-500">
                    Điểm khớp TB: <strong className="text-[#E8872A]">{analytics.avgScore}%</strong> · Cao nhất:{' '}
                    <strong className="text-emerald-600">{analytics.maxScore}%</strong>
                  </span>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-slate-200/80 bg-white p-3">
                    <p className="text-[11px] font-semibold text-slate-400">Chức danh & Cấp bậc</p>
                    <p className="mt-0.5 text-xs font-bold text-[#072348]">{jobSummary.titleText}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {jobSummary.levelText} · {jobSummary.expText}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white p-3">
                    <p className="text-[11px] font-semibold text-slate-400">Khu vực & Địa điểm</p>
                    <p className="mt-0.5 text-xs font-bold text-[#072348]">{jobSummary.locationText}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">Quét tự động 2 giờ/lần</p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white p-3">
                    <p className="text-[11px] font-semibold text-slate-400">Ngân sách lương JD</p>
                    <p className="mt-0.5 text-xs font-bold text-[#E8872A]">{jobSummary.salaryText}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Đã điều chỉnh JD: {entitlements.revisionsUsed}/{entitlements.revisionQuota ?? '∞'} lần
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white p-3">
                    <p className="text-[11px] font-semibold text-slate-400">Hạn mức Gói Săn đã dùng</p>
                    <p className="mt-0.5 text-xs font-bold text-[#072348]">
                      Mở hồ sơ: {entitlements.profileOpensUsed}/{entitlements.creditQuota ?? '∞'} Credit
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Shortlist: {entitlements.shortlistsUsed}/{entitlements.shortlistQuota ?? '∞'} ứng viên
                    </p>
                  </div>
                </div>
              </section>

              {/* PHẦN II: PHỄU CHUYỂN ĐỔI SĂN NHÂN SỰ */}
              <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#072348]">
                      II. Phễu Chuyển đổi Tuyển dụng & Săn Nhân sự (Recruitment Funnel)
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Đo lường tỷ lệ chuyển đổi thực tế từ nguồn quét AI đến danh sách ứng viên trình phỏng vấn
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {funnelSteps.map((f) => (
                    <div
                      key={f.step}
                      className="rounded-xl border border-slate-100 bg-[#f8fafc] px-3.5 py-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-[#072348]">{f.step}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500">{f.note}</span>
                          <span className="min-w-14 rounded-lg bg-white px-2 py-0.5 text-right text-sm font-extrabold tabular-nums text-[#E8872A] shadow-2xs ring-1 ring-slate-200/80">
                            {f.count}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/80">
                        <div
                          className={clsx('h-full rounded-full transition-all duration-700', f.barClass)}
                          style={{ width: `${Math.max(4, f.pct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* PHẦN III: DANH SÁCH ỨNG VIÊN TRỌNG ĐIỂM TRÌNH SẾP / QUẢN LÝ */}
              <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#072348]">
                      III. Danh sách Ứng viên Trọng điểm Trình Quản lý Duyệt ({analytics.prioritizedCandidates.length})
                    </h4>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Ưu tiên hiển thị ứng viên trong Shortlist, ứng viên đã nộp đơn và ứng viên có điểm khớp JD cao nhất
                    </p>
                  </div>
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                    ★ Đã chọn Shortlist: {analytics.shortlistedCount} ứng viên
                  </span>
                </div>

                {analytics.prioritizedCandidates.length === 0 ? (
                  <div className="mt-4 rounded-xl bg-[#f8fafc] px-4 py-8 text-center text-xs text-slate-500">
                    Chưa có ứng viên đạt ngưỡng khớp JD. Hãy sử dụng mục «Điều chỉnh tiêu chí» để mở rộng tệp ứng viên.
                  </div>
                ) : (
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200/80">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-[#072348] text-[11px] font-bold uppercase text-white">
                        <tr>
                          <th className="px-3 py-2.5 text-center">#</th>
                          <th className="px-3.5 py-2.5">Ứng viên & Vị trí hiện tại</th>
                          <th className="px-3 py-2.5">Khu vực</th>
                          <th className="px-3 py-2.5 text-center">Độ khớp JD</th>
                          <th className="px-3.5 py-2.5">Điểm mạnh đáp ứng JD & Lưu ý phỏng vấn</th>
                          <th className="px-3.5 py-2.5">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70 bg-white">
                        {analytics.prioritizedCandidates.slice(0, 12).map((cand, idx) => {
                          const isSl = shortlistedIds.includes(cand.candidateId);
                          const pct = formatMatchPct(cand.match.score);
                          const ringColor = matchRingColor(cand.match.score);
                          return (
                            <tr key={cand.candidateId} className="hover:bg-slate-50/80">
                              <td className="px-3 py-3 text-center font-bold text-slate-400">{idx + 1}</td>
                              <td className="px-3.5 py-3">
                                <p className="font-bold text-[#072348]">{cand.displayName}</p>
                                <p className="mt-0.5 text-[11px] text-slate-500">
                                  {cand.currentPosition ? formatJobTitle(cand.currentPosition) : 'Chưa cập nhật vị trí'}
                                  {cand.industry ? ` · ${cand.industry}` : ''}
                                </p>
                              </td>
                              <td className="px-3 py-3 text-slate-600">{cand.location ?? '—'}</td>
                              <td className="px-3 py-3 text-center">
                                <span
                                  className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-extrabold tabular-nums ring-1"
                                  style={{
                                    color: ringColor,
                                    borderColor: `${ringColor}40`,
                                    backgroundColor: `${ringColor}10`,
                                  }}
                                >
                                  {pct}%
                                </span>
                              </td>
                              <td className="px-3.5 py-3">
                                <p className="text-slate-700">
                                  <strong className="text-emerald-700">Đáp ứng:</strong>{' '}
                                  {(cand.match.matchedSkills ?? []).slice(0, 4).join(', ') || 'Kinh nghiệm chuyên môn phù hợp'}
                                </p>
                                {(cand.match.missingSkills ?? []).length > 0 ? (
                                  <p className="mt-0.5 text-[11px] text-amber-800">
                                    <strong>Lưu ý PV:</strong> {(cand.match.missingSkills ?? []).slice(0, 3).join(', ')}
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-3.5 py-3">
                                <div className="flex flex-wrap gap-1">
                                  {isSl ? (
                                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-indigo-200">
                                      ★ Shortlist
                                    </span>
                                  ) : null}
                                  {cand.applied ? (
                                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                                      Đã ứng tuyển
                                    </span>
                                  ) : cand.viewed ? (
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                      Đã thẩm định
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                      Chờ mở hồ sơ
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* PHẦN IV & V: PHÂN TÍCH THỊ TRƯỜNG & KHUYẾN NGHỊ HÀNH ĐỘNG TRÌNH DUYỆT */}
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-[#d7e3f2] bg-[#f8fafc] p-4 sm:p-5">
                  <h4 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#072348]">
                    <TrendingUp className="h-4 w-4 text-[#E8872A]" />
                    IV. Phân tích Thực tế Thị trường & Điểm nghẽn Tiêu chí
                  </h4>
                  <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-slate-700">
                    {analytics.bottlenecks.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#072348]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  {analytics.topMissing.length > 0 ? (
                    <div className="mt-3.5 border-t border-slate-200/80 pt-3">
                      <p className="text-[11px] font-bold text-slate-600">
                        Tỷ lệ ứng viên bị thiếu theo từng tiêu chí JD:
                      </p>
                      <div className="mt-2 space-y-1.5">
                        {analytics.topMissing.map(([label, count]) => {
                          const pct = Math.round((count / Math.max(1, analytics.totalMatched)) * 100);
                          return (
                            <div key={label} className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="truncate font-medium text-slate-700">{label}</span>
                              <span className="shrink-0 font-bold text-rose-600">
                                {count} UV ({pct}%)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
                  <h4 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[#072348]">
                    <Sparkles className="h-4 w-4 text-[#E8872A]" />
                    V. Đề xuất Kế hoạch Hành động Tuần tới (Trình Sếp Duyệt)
                  </h4>
                  <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-slate-800">
                    {analytics.recommendations.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#E8872A]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {errText ? (
                <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{errText}</p>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <p className="text-xs text-slate-500">
                  * Bấm <strong>«Xuất PDF / Bản In A4 trình Sếp»</strong> hoặc <strong>«Xuất Excel (.csv)»</strong> ở góc trên để tải báo cáo bất cứ lúc nào. Bấm nút bên phải khi muốn lưu chốt 1 kỳ báo cáo tuần vào hệ thống.
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
                    Chuyển sang tab «Báo cáo Tổng hợp Thời gian thực» và bấm Chốt & Lưu Báo cáo để lưu lại tiến độ từng tuần.
                  </p>
                </div>
              ) : (
                savedReports.map((rep) => (
                  <div key={rep.id} className="rounded-2xl border border-[#d7e3f2] bg-white p-4 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-[#072348]">{rep.title}</h4>
                        <span className="text-xs text-slate-400">
                          Ngày chốt:{' '}
                          {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(
                            new Date(rep.createdAt),
                          )}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePrintExecutiveReport(rep)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-[#072348] transition hover:bg-slate-100"
                      >
                        <Printer className="h-3.5 w-3.5 text-[#E8872A]" />
                        In / Xuất PDF kỳ này
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                        Hồ sơ rà soát: {rep.totalScanned}
                      </span>
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
                        <p className="font-bold text-[#072348]">Đề xuất hành động tại kỳ báo cáo:</p>
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

export type SourcingDrawerSection = 'overview' | 'jd_match' | 'contact' | 'interview' | 'unlock';

export function SourcingCandidateDrawer({
  candidateRow,
  initialSection = 'overview',
  onClose,
  engagementId,
  engagementTitle,
  jobId,
  entitlements,
  isShortlisted,
  outreachItem,
  onShortlistSuccess,
  onOutreachSuccess,
  onProfileUnlocked,
}: {
  candidateRow: CandidateMatchView | null;
  initialSection?: SourcingDrawerSection;
  onClose: () => void;
  engagementId: string | null;
  engagementTitle: string;
  jobId: string | null;
  entitlements: RecruiterSourcingEntitlements;
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

  const hasOutreach = useMemo(() => {
    const scope = entitlements.serviceScope ?? [];
    return (
      scope.includes('outreach') ||
      entitlements.planCode === 'SAN_CHUYEN_SAU' ||
      (entitlements.outreachQuota != null && entitlements.outreachQuota > 0)
    );
  }, [entitlements.outreachQuota, entitlements.planCode, entitlements.serviceScope]);
  const outreachQuota = entitlements.outreachQuota ?? entitlements.shortlistQuota ?? 15;
  const outreachRemaining = entitlements.outreachRemaining ?? entitlements.shortlistsRemaining ?? outreachQuota;
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
      `Chào ${candidateRow.displayName}, công ty chúng tôi đang tuyển vị trí «${engagementTitle}» rất phù hợp với kinh nghiệm của bạn trên inlink. Mong được kết nối trao đổi thêm cùng bạn!`,
    );
    setOutreachNote(
      `Nhờ CSKH Inlink liên hệ ứng viên ${candidateRow.displayName} cho vị trí «${engagementTitle}», thẩm định nhu cầu chuyển việc & mức lương kỳ vọng giúp doanh nghiệp.`,
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
  }, [candidateRow, engagementTitle, initialSection, outreachItem]);

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
      if (isShortlisted) {
        await removeCandidateShortlist(candidateRow.candidateId).catch(() => null);
        const ws = await consumeRecruiterSourcing({
          kind: 'shortlist',
          engagementId,
          jobId: jobId ?? undefined,
          note: `unshortlist:${candidateRow.candidateId}:${candidateRow.displayName}`,
        });
        return { ws, removed: true };
      }
      await addCandidateShortlist(candidateRow.candidateId).catch(() => null);
      const ws = await consumeRecruiterSourcing({
        kind: 'shortlist',
        engagementId,
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
      if (!candidateRow || !engagementId) throw new Error('Chưa chọn vị trí Săn');
      const cleanName = candidateRow.displayName.replace(/:/g, ' ');
      const cleanNote = outreachNote.trim().replace(/:/g, ' -');
      const ws = await consumeRecruiterSourcing({
        kind: 'shortlist',
        engagementId,
        jobId: jobId ?? undefined,
        note: `outreach:${candidateRow.candidateId}:${cleanName}:${cleanNote}`,
      });
      const detailRes = await getCandidateById(candidateRow.candidateId, 'sourcing', pctStr).catch(
        () => null,
      );
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
      if (!candidateRow || !engagementId) throw new Error('Chưa chọn vị trí Săn');
      return consumeRecruiterSourcing({
        kind: 'shortlist',
        engagementId,
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

          {/* Đối chiếu mức độ phù hợp JD (hiển thị ngay cả trước khi mở khóa) */}
          <div
            ref={jdMatchRef}
            className="rounded-2xl border border-[#d7e3f2] bg-white p-4 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-[#072348]">
                <Sparkles className="h-3.5 w-3.5 text-[#E8872A]" />
                Đối chiếu mức độ phù hợp JD
              </h4>
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-[#c96a12] ring-1 ring-amber-200/80">
                Độ phù hợp {pctStr.replace('.', ',')}%
              </span>
            </div>
            {candidateRow.match.reason ? (
              <p className="text-xs leading-relaxed text-slate-600">{candidateRow.match.reason}</p>
            ) : null}
            {candidateRow.match.matchedSkills?.length > 0 ? (
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-emerald-800">Tiêu chí & kỹ năng đáp ứng:</p>
                <div className="flex flex-wrap gap-1.5">
                  {candidateRow.match.matchedSkills.map((sk) => (
                    <span
                      key={sk}
                      className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200/70"
                    >
                      ✓ {sk}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {candidateRow.match.missingSkills?.length > 0 ? (
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-slate-500">Cần lưu ý / bổ sung khi phỏng vấn:</p>
                <div className="flex flex-wrap gap-1.5">
                  {candidateRow.match.missingSkills.map((sk) => (
                    <span
                      key={sk}
                      className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
                    >
                      {sk}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

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
                    <strong>ưu tiên trừ trực tiếp từ {entitlements.profileOpensRemaining ?? 0} Credit có sẵn trong Gói Săn</strong>{' '}
                    của bạn mà không làm tốn ví Credit mua lẻ.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
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

                    {hasOutreach && !isOutreached ? (
                      <button
                        type="button"
                        disabled={outreachMutation.isPending || (outreachRemaining != null && outreachRemaining <= 0)}
                        onClick={() => setShowOutreachForm(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#072348]/25 bg-white px-3.5 py-2 text-xs font-bold text-[#072348] shadow-2xs transition hover:border-[#072348] hover:bg-[#072348] hover:text-white disabled:opacity-45"
                      >
                        <Headphones className="h-3.5 w-3.5 text-[#E8872A]" />
                        Giao Inlink liên hệ & Mở khóa (Còn {outreachRemaining ?? 0}/{outreachQuota})
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
    </div>
  );
}
