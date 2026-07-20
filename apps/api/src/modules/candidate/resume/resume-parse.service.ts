import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CandidateStatus, DomainEvents } from '@industriallink/contracts';
import { ResumeParseStatus } from '@industriallink/contracts';
import type { AppConfig } from '../../../config/configuration';
import { AiGatewayService } from '../../ai/ai-gateway.service';
import { SkillService } from '../../knowledge/skill.service';
import { createDomainEvent } from '../../../shared/domain/domain-event';
import { AppEventBus } from '../../../shared/events/event-bus';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { StorageService } from '../../../shared/infrastructure/storage/storage.service';
import { ExtractTextError, extractResumeText } from './extract-text.util';
import type { ResumeParseJobData } from './queue.constants';

/**
 * Logic phân tích CV (chạy trong worker BullMQ, tách khỏi hạ tầng queue).
 *
 * Luồng: đọc file -> AI Gateway hiểu CV -> tạo Profile/Skill/AI Profile/Embedding
 * -> phát ResumeParsed + CandidateUpdated. Không bước nào làm thủ công.
 */
@Injectable()
export class ResumeParseService {
  private readonly logger = new Logger(ResumeParseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ai: AiGatewayService,
    private readonly skills: SkillService,
    private readonly events: AppEventBus,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async process(data: ResumeParseJobData): Promise<void> {
    const { resumeId, candidateId, tenantId, correlationId } = data;
    this.logger.log(`Bắt đầu phân tích CV resumeId=${resumeId}`);

    const resume = await this.prisma.candidateResume.findUnique({ where: { id: resumeId } });
    if (!resume) {
      throw new Error(`Không tìm thấy resume ${resumeId}`);
    }

    await this.prisma.candidateResume.update({
      where: { id: resumeId },
      data: { parseStatus: ResumeParseStatus.Processing },
    });

    try {
      const buffer = await this.storage.getObject(resume.storageKey);
      let text: string;
      try {
        text = await extractResumeText(buffer, resume.mime);
      } catch (err) {
        const message =
          err instanceof ExtractTextError
            ? err.message
            : `Không đọc được nội dung CV: ${String(err).slice(0, 300)}`;
        throw new Error(message);
      }

      if (!text.trim()) {
        // Extract thành công nhưng không có chữ (ví dụ PDF scan).
        // AI thật: fail rõ, tránh ghi profile rỗng/sai.
        // Mock: được phép suy luận từ tên file (dev/demo).
        const aiProvider = this.config.get('ai', { infer: true }).provider;
        if (aiProvider === 'mock') {
          this.logger.warn(
            `Không trích được text từ CV "${resume.fileName}" (mime=${resume.mime}); AI mock sẽ suy luận từ tên file.`,
          );
        } else {
          throw new Error(
            'Không trích được nội dung CV từ file. Vui lòng tải PDF/DOCX/TXT có chữ (không phải ảnh scan) hoặc kiểm tra file bị hỏng.',
          );
        }
      }

      const parsed = await this.ai.parseResume({ fileName: resume.fileName, text });

      // 1) Hồ sơ nghề nghiệp
      await this.prisma.candidateProfile.upsert({
        where: { candidateId },
        create: {
          candidateId,
          currentPosition: parsed.currentPosition,
          jobLevel: parsed.jobLevel,
          totalExperienceYears: parsed.totalExperienceYears,
          industry: parsed.industry,
          specialization: parsed.specialization,
          summary: parsed.summary,
        },
        update: {
          currentPosition: parsed.currentPosition,
          jobLevel: parsed.jobLevel,
          totalExperienceYears: parsed.totalExperienceYears,
          industry: parsed.industry,
          specialization: parsed.specialization,
          summary: parsed.summary,
        },
      });

      // 2) Kỹ năng (chuẩn hoá về skill_id khi có trong Taxonomy)
      await this.prisma.candidateSkill.deleteMany({ where: { candidateId } });
      for (const skill of parsed.skills) {
        const skillId = await this.skills.resolveSkillId(skill.name);
        await this.prisma.candidateSkill.create({
          data: {
            candidateId,
            skillId,
            name: skill.name,
            level: skill.level,
            yearsOfExperience: skill.yearsOfExperience,
          },
        });
      }

      // 3) Hồ sơ AI + embedding (pgvector qua raw SQL)
      const aiProfile = await this.prisma.candidateAiProfile.upsert({
        where: { candidateId },
        create: {
          candidateId,
          summary: parsed.summary,
          strengths: parsed.strengths,
          weaknesses: parsed.weaknesses,
          careerPath: parsed.careerPath,
          aiScore: parsed.aiScore,
          confidence: parsed.confidence,
          lastAnalyzedAt: new Date(),
        },
        update: {
          summary: parsed.summary,
          strengths: parsed.strengths,
          weaknesses: parsed.weaknesses,
          careerPath: parsed.careerPath,
          aiScore: parsed.aiScore,
          confidence: parsed.confidence,
          lastAnalyzedAt: new Date(),
        },
      });

      const embeddingText = [
        parsed.summary,
        parsed.industry,
        parsed.specialization,
        parsed.skills.map((s) => s.name).join(', '),
      ]
        .filter(Boolean)
        .join('. ');
      await this.saveEmbedding(aiProfile.candidateId, embeddingText);

      // 4) Cập nhật trạng thái ứng viên + resume
      await this.prisma.candidate.update({
        where: { id: candidateId },
        data: { status: CandidateStatus.Completed, profileCompletion: 80 },
      });
      await this.prisma.candidateResume.update({
        where: { id: resumeId },
        data: { parseStatus: ResumeParseStatus.Completed, parseError: null },
      });

      await this.prisma.candidateTimeline.create({
        data: {
          candidateId,
          tenantId,
          type: 'resume_parsed',
          title: 'AI đã phân tích xong CV',
          description: `Nhận diện ${parsed.skills.length} kỹ năng, ngành ${parsed.industry ?? 'N/A'}.`,
        },
      });

      // 5) Phát sự kiện cho Search/Analytics/Timeline (không gọi trực tiếp Domain khác)
      this.events.publish(
        createDomainEvent({
          name: DomainEvents.ResumeParsed,
          tenantId,
          correlationId,
          payload: { candidateId, resumeId, skillCount: parsed.skills.length },
        }),
      );
      this.events.publish(
        createDomainEvent({
          name: DomainEvents.CandidateUpdated,
          tenantId,
          correlationId,
          payload: { candidateId },
        }),
      );

      this.logger.log(`Hoàn tất phân tích CV resumeId=${resumeId}`);
    } catch (err) {
      const parseError =
        err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500);
      await this.prisma.candidateResume.update({
        where: { id: resumeId },
        data: { parseStatus: ResumeParseStatus.Failed, parseError },
      });
      throw err;
    }
  }

  /** Ghi embedding vào cột pgvector qua raw SQL (Prisma bỏ qua cột Unsupported). */
  private async saveEmbedding(candidateId: string, text: string): Promise<void> {
    try {
      const vector = await this.ai.embed(text);
      const literal = `[${vector.join(',')}]`;
      await this.prisma.$executeRaw`
        UPDATE candidate.candidate_ai_profile
        SET embedding = ${literal}::vector
        WHERE candidate_id = ${candidateId}::uuid`;
    } catch (err) {
      // Không chặn luồng nếu vector store gặp sự cố.
      this.logger.warn(`Bỏ qua lưu embedding cho ${candidateId}: ${String(err)}`);
    }
  }
}
