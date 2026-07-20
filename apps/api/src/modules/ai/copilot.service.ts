import { Injectable, Logger } from '@nestjs/common';
import type { CopilotChatResponse, CopilotSource } from '@industriallink/contracts';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { ApplicationService } from '../recruitment/application.service';
import { JobService } from '../recruitment/job.service';
import { SearchService } from '../search/search.service';
import { AiGatewayService } from './ai-gateway.service';

const COPILOT_SYSTEM = `Bạn là AI Copilot tuyển dụng của IndustrialLink (B2B công nghiệp Việt Nam).
Trả lời ngắn gọn, tiếng Việt, dựa trên NGỮ CẢNH được cung cấp (pipeline, tin tuyển dụng, ứng viên).
Không bịa số liệu ngoài ngữ cảnh. Nếu thiếu dữ liệu, nói rõ và gợi ý bước tiếp (Inbox, Search, Đăng tin).
Không tiết lộ thông tin nhạy cảm không liên quan.`;

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
      const hits = await this.search.searchCandidates(trimmed, user.tenantId);
      if (hits.length > 0) {
        const lines = hits.slice(0, 8).map(
          (h) =>
            `- ${h.displayName}${h.currentPosition ? ` · ${h.currentPosition}` : ''} · phù hợp ${(h.score * 100).toFixed(0)}% — ${h.reason}`,
        );
        const snippet = lines.join('\n');
        sources.push({ title: 'Ứng viên liên quan', snippet });
        parts.push(`### Ứng viên liên quan\n${snippet}`);
      }
    } catch (err) {
      this.logger.debug(`Copilot: bỏ qua candidate search: ${String(err)}`);
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
}
