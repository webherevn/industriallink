import { Injectable, Logger } from '@nestjs/common';
import type {
  CopilotChatResponse,
  CopilotSource,
  InboxApplicantView,
  OpenJobMatchBoard,
} from '@industriallink/contracts';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { ApplicationService } from '../recruitment/application.service';
import { JobService } from '../recruitment/job.service';
import { MatchingService } from '../recruitment/matching.service';
import { SearchService } from '../search/search.service';
import { AiGatewayService } from './ai-gateway.service';

const COPILOT_SYSTEM = `Bạn là AI Copilot tuyển dụng của inlink (B2B công nghiệp Việt Nam).
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
    private readonly matching: MatchingService,
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

    let matchAnswer: string | null = null;
    if (isFindCandidatesQuery(trimmed)) {
      try {
        const boards = filterMatchBoards(await this.matching.openJobMatchBoards(user), trimmed);
        if (boards.some((b) => b.candidates.length > 0)) {
          matchAnswer = buildMatchAnswer(boards);
          const snippet = matchSnippet(boards);
          sources.push({
            title: 'Ứng viên phù hợp (AI gợi ý)',
            snippet,
            candidateIds: boards.flatMap((b) => b.candidates.map((c) => c.candidateId)),
          });
          parts.push(`### Ứng viên phù hợp (điểm matching)\n${snippet}`);
        }
      } catch (err) {
        this.logger.debug(`Copilot: không chấm được matching: ${String(err)}`);
      }
    }

    if (!matchAnswer) {
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
    }

    const context = parts.join('\n\n') || '(Chưa có dữ liệu nội bộ — tài khoản mới hoặc chưa có tin/ứng viên.)';
    const userPrompt = `Ngữ cảnh:\n${context}\n\nCâu hỏi:\n${trimmed}`;

    if (matchAnswer) {
      return { answer: matchAnswer, sources, provider: 'matching' };
    }

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
    const picked: SuggestedCandidate[] = [];
    const seen = new Set<string>();

    try {
      const inbox = await this.applications.listCompanyInbox(user, 100);
      const fromApplied = rankAppliedCandidates(inbox)
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
            : 'Mạng lưới inlink',
          origin: 'network',
        });
      }
    } catch (err) {
      this.logger.debug(`Copilot: không search được mạng lưới: ${String(err)}`);
    }

    return picked.slice(0, TOP_CANDIDATES);
  }
}

function rankAppliedCandidates(inbox: InboxApplicantView[]): SuggestedCandidate[] {
  const byCandidate = new Map<string, SuggestedCandidate>();

  for (const a of inbox) {
    const match = Math.max(0, Math.min(100, a.matchScore ?? 0));
    const scorePct = Math.round(match * 10) / 10;

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

function isFindCandidatesQuery(message: string): boolean {
  const q = message.toLowerCase();
  const find = q.includes('tìm') || q.includes('tim');
  const person = q.includes('ứng viên') || q.includes('ung vien');
  return find && person;
}

function enginePct(score: number): string {
  const numeric = score <= 1 ? score * 100 : score;
  const clamped = Math.max(0, Math.min(100, numeric));
  return clamped.toFixed(1);
}

function filterMatchBoards(boards: OpenJobMatchBoard[], query: string): OpenJobMatchBoard[] {
  const tokens = tokenizeQuery(query).filter((t) => !FIND_QUERY_NOISE.has(t));
  if (tokens.length === 0) return boards;
  const picked = boards.filter((board) => {
    const jobHay = `${board.jobTitle} ${board.jobCode}`.toLowerCase();
    if (tokens.some((t) => jobHay.includes(t))) return true;
    return board.candidates.some((c) => {
      const hay = `${c.displayName} ${c.currentPosition ?? ''} ${c.industry ?? ''}`.toLowerCase();
      return tokens.some((t) => hay.includes(t));
    });
  });
  return picked.length > 0 ? picked : boards;
}

function matchSnippet(boards: OpenJobMatchBoard[]): string {
  return boards
    .flatMap((board) =>
      board.candidates.map((c) => {
        const where = c.applied ? 'Đã nộp hồ sơ' : 'Mạng lưới';
        const pos = c.currentPosition ? ` · ${c.currentPosition}` : '';
        return `- ${c.displayName}${pos} · phù hợp ${enginePct(c.match.score)}% — ${where} · tin «${board.jobTitle}»`;
      }),
    )
    .join('\n');
}

function buildMatchAnswer(boards: OpenJobMatchBoard[]): string {
  const lines = ['Dưới đây là ứng viên phù hợp theo đúng điểm AI gợi ý ứng viên:', ''];
  boards.forEach((board, index) => {
    lines.push(`${index + 1}. Tin «${board.jobTitle}» (${board.jobCode})`);
    if (board.candidates.length === 0) {
      lines.push('- Chưa có ứng viên đủ điểm cho tin này.');
      lines.push('');
      return;
    }
    for (const c of board.candidates) {
      const where = c.applied ? 'Đã nộp hồ sơ' : 'Mạng lưới';
      const pos = c.currentPosition ? `: ${c.currentPosition}` : '';
      lines.push(`- ${c.displayName} (Phù hợp ${enginePct(c.match.score)}%)${pos}. ${where}.`);
    }
    lines.push('');
  });
  return lines.join('\n').trim();
}

const FIND_QUERY_NOISE = new Set([
  'tin',
  'dang',
  'mo',
  'viec',
  'lam',
  'nganh',
  'luong',
  'tai',
]);
