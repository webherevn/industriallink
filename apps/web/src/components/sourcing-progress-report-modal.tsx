'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { CheckCircle2, Download, FileBarChart2, Loader2, Printer, Sparkles, TrendingUp, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ExperienceBand, formatJobLevel, formatJobTitle, type CandidateMatchView, type RecruiterSourcingEntitlements, type RecruiterSourcingReportView, type RecruiterSourcingScanRoundView, type RecruiterSourcingWorkspace } from '@industriallink/contracts';
import { Button } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { EXPERIENCE_LABEL, formatVndAmount } from '@/lib/format';
import { getJob } from '@/lib/jobs';
import { formatMatchPct, matchRingColor } from '@/lib/match-percent';
import { consumeRecruiterSourcing } from '@/lib/recruiter-billing';

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
  campaignId,
  campaignTitle,
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
  campaignId: string | null;
  campaignTitle: string;
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
    const normPct = (s: number) => Math.max(0, Math.min(100, s));
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
    const titleText = job?.title ? formatJobTitle(job.title) : campaignTitle || 'Vị trí Săn nhân sự';
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
  }, [job, campaignTitle]);

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
      if (!campaignId) throw new Error('Chưa chọn vị trí Tin Săn');
      const nextNum = savedReports.length + 1;
      const reportPayload = {
        reportNumber: nextNum,
        title: `Báo cáo tiến độ tuần #${nextNum} - ${campaignTitle}`,
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
        campaignId: campaignId,
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
    Boolean(campaignId) &&
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
