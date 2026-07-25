import { Injectable, Logger } from '@nestjs/common';
import type {
  CopilotChatResponse,
  CopilotSource,
  InboxApplicantView,
} from '@industriallink/contracts';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { ApplicationService } from '../recruitment/application.service';
import { JobService } from '../recruitment/job.service';
import { SearchService } from '../search/search.service';
import { AiGatewayService } from './ai-gateway.service';

const COPILOT_SYSTEM = `Bạn là AI Copilot tuyển dụng của IndustrialLink (B2B công nghiệp Việt Nam).
Trả lời ngắn gọn, tiếng Việt, dựa trên NGỮ CẢNH được cung cấp (pipeline, tin tuyển dụng, ứng viên).
Khi gợi ý ứng viên: ưu tiên hồ sơ đã nộp vào tin của công ty; chỉ bổ sung từ mạng lưới khi thiếu.
Không bịa số liệu ngoài ngữ cảnh. Nếu thiếu dữ liệu, nói rõ và gợi ý bước tiếp (Inbox, Search, Đăng tin).
Không tiết lộ thông tin nhạy cảm không liên quan.`;

const TOP_CANDIDATES = 3;
/** Ngưỡng tối thiểu để coi ứng viên đã nộp là “khớp” câu hỏi (0–100). */
const MIN_APPLIED_SCORE = 18;

type SuggestedCandidate = {
  candidateId: string;
  displayName: string;
  currentPosition: string | null;
  scorePct: number;
  reason: string;
  origin: 'applied' | 'network';
};

/**
 * RAG Copilot: retrieve ngữ cảnh nội bộ (jobs / pipeline / candidate search) → LLM chat.
 */
@Injectable()
export class CopilotService {
  private readonly logger = new Logger(CopilotService.name);

  constructor(
    private readonly ai: AiGatewayService,
    private readonly jobs: JobService,
    private readonly applications: ApplicationService,
    private readonly search: SearchService,
  ) {}

  async chat(user: AuthenticatedUser, message: string): Promise<CopilotChatResponse> {
    const trimmed = message.trim();
    const sources: CopilotSource[] = [];
    const parts: string[] = [];

    try {
      const summary = await this.applications.getWorkspaceSummary(user);
      const pipelineText = [
        `Công ty: ${summary.companyName ?? '—'}`,
        `Tổng tin: ${summary.jobCount} (đang mở: ${summary.publishedJobCount})`,
        `Tổng hồ sơ: ${summary.applicationCount}`,
        `Hồ sơ mới (Applied): ${summary.newApplicationCount}`,
      ].join('\n');
      sources.push({ title: 'Pipeline workspace', snippet: pipelineText });
      parts.push(`### Pipeline workspace\n${pipelineText}`);
    } catch (err) {
      this.logger.debug(`Copilot: bỏ qua workspace summary: ${String(err)}`);
    }

    try {
      const myJobs = await this.jobs.listMyJobs(user);
      const jobLines = myJobs
        .slice(0, 12)
        .map((j) => `- ${j.title} (${j.status}) · ${j.code}`);
      if (jobLines.length) {
        const snippet = jobLines.join('\n');
        sources.push({ title: 'Tin tuyển dụng', snippet });
        parts.push(`### Tin tuyển dụng\n${snippet}`);
      }
    } catch (err) {
      this.logger.debug(`Copilot: bỏ qua jobs: ${String(err)}`);
    }

    try {
      const suggestions = await this.suggestTopCandidates(user, trimmed);
      if (suggestions.length > 0) {
        const lines = suggestions.map(
          (h) =>
            `- ${h.displayName}${h.currentPosition ? ` · ${h.currentPosition}` : ''} · phù hợp ${h.scorePct}% — ${h.reason}`,
        );
        const snippet = lines.join('\n');
        const appliedCount = suggestions.filter((s) => s.origin === 'applied').length;
        const title =
          appliedCount > 0
            ? 'Ứng viên phù hợp nhất (ưu tiên đã nộp)'
            : 'Ứng viên phù hợp nhất (mạng lưới)';
        sources.push({
          title,
          snippet,
          candidateIds: suggestions.map((h) => h.candidateId),
        });
        parts.push(`### ${title}\n${snippet}`);
      }
    } catch (err) {
      this.logger.debug(`Copilot: bỏ qua candidate suggest: ${String(err)}`);
    }

    const context = parts.join('\n\n') || '(Chưa có dữ liệu nội bộ — tài khoản mới hoặc chưa có tin/ứng viên.)';
    const userPrompt = `Ngữ cảnh:\n${context}\n\nCâu hỏi:\n${trimmed}`;

    const answer = await this.ai.chat({
      system: COPILOT_SYSTEM,
      user: userPrompt,
    });

    return {
      answer: answer.trim() || 'Xin lỗi, tôi chưa tạo được câu trả lời. Thử hỏi lại cụ thể hơn.',
      sources,
      provider: this.ai.providerName,
    };
  }

  /**
   * Lấy 2–3 ứng viên phù hợp nhất:
   * 1) Ưu tiên hồ sơ đã nộp vào tin của công ty (lọc theo câu hỏi + matchScore)
   * 2) Nếu thiếu → bổ sung từ chỉ mục ứng viên toàn mạng (search)
   */
  private async suggestTopCandidates(
    user: AuthenticatedUser,
    query: string,
  ): Promise<SuggestedCandidate[]> {
    const tokens = tokenizeQuery(query);
    const picked: SuggestedCandidate[] = [];
    const seen = new Set<string>();

    try {
      const inbox = await this.applications.listCompanyInbox(user, 100);
      const fromApplied = rankAppliedCandidates(inbox, tokens)
        .filter((s) => s.scorePct >= MIN_APPLIED_SCORE)
        .slice(0, TOP_CANDIDATES);

      for (const s of fromApplied) {
        if (seen.has(s.candidateId)) continue;
        seen.add(s.candidateId);
        picked.push(s);
      }
    } catch (err) {
      this.logger.debug(`Copilot: không đọc được inbox: ${String(err)}`);
    }

    if (picked.length >= TOP_CANDIDATES) {
      return picked.slice(0, TOP_CANDIDATES);
    }

    try {
      const hits = await this.search.searchCandidates(query || 'ứng viên', user.tenantId);
      for (const h of hits) {
        if (picked.length >= TOP_CANDIDATES) break;
        if (seen.has(h.candidateId)) continue;
        seen.add(h.candidateId);
        picked.push({
          candidateId: h.candidateId,
          displayName: h.displayName,
          currentPosition: h.currentPosition,
          scorePct: Math.max(1, Math.round(h.score * 100)),
          reason: h.reason?.trim()
            ? `Mạng lưới · ${h.reason}`
            : 'Mạng lưới IndustrialLink',
          origin: 'network',
        });
      }
    } catch (err) {
      this.logger.debug(`Copilot: không search được mạng lưới: ${String(err)}`);
    }

    return picked.slice(0, TOP_CANDIDATES);
  }
}

function rankAppliedCandidates(
  inbox: InboxApplicantView[],
  tokens: string[],
): SuggestedCandidate[] {
  const byCandidate = new Map<string, SuggestedCandidate>();

  for (const a of inbox) {
    const match = Math.max(0, Math.min(100, a.matchScore ?? 0));
    const textPct = Math.round(textRelevance(tokens, [
      a.displayName,
      a.currentPosition ?? '',
      a.industry ?? '',
      a.jobTitle,
      ...a.matchedSkills,
    ]) * 100);

    // Không có từ khóa → xếp theo matchScore tin đã nộp
    const scorePct =
      tokens.length === 0
        ? match || 40
        : Math.round(match * 0.55 + textPct * 0.45);

    const next: SuggestedCandidate = {
      candidateId: a.candidateId,
      displayName: a.displayName,
      currentPosition: a.currentPosition,
      scorePct,
      reason: `Đã nộp tin «${a.jobTitle}»`,
      origin: 'applied',
    };

    const prev = byCandidate.get(a.candidateId);
    if (!prev || next.scorePct > prev.scorePct) {
      byCandidate.set(a.candidateId, next);
    }
  }

  return [...byCandidate.values()].sort((a, b) => b.scorePct - a.scorePct);
}

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .filter((t) => !STOP_WORDS.has(t));
}

const STOP_WORDS = new Set([
  'tim',
  'tìm',
  'ung',
  'vien',
  'ứng',
  'viên',
  'cho',
  'toi',
  'tôi',
  'voi',
  'với',
  'va',
  'và',
  'cac',
  'các',
  'mot',
  'một',
  'nguoi',
  'người',
  'nhan',
  'viên',
  'phu',
  'hop',
  'phù',
  'hợp',
  'giup',
  'giúp',
  'hay',
  'hoac',
  'hoặc',
  'the',
  'and',
  'for',
  'with',
]);

/** Độ khớp từ khóa đơn giản 0–1 trên các trường hồ sơ. */
function textRelevance(tokens: string[], fields: string[]): number {
  if (tokens.length === 0) return 0;
  const hay = fields
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
  if (!hay.trim()) return 0;
  let hit = 0;
  for (const t of tokens) {
    if (hay.includes(t)) hit += 1;
  }
  return hit / tokens.length;
}
