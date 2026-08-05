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
import { computeProfileCompletion } from '../candidate.service';
import { ExtractTextError, extractResumeText } from './extract-text.util';
import {
  buildExperienceRowFromParsed,
  buildProfileDataFromParsed,
} from './map-parsed-resume';
import type { ResumeParseJobData } from './queue.constants';

/**
 * Logic phân tích CV (chạy trong worker BullMQ, tách khỏi hạ tầng queue).
 *
 * Luồng: đọc file -> AI Gateway (Gemini) hiểu CV -> ghi đầy đủ Profile/Skill/Experience/AI
 * -> phát ResumeParsed + CandidateUpdated.
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
      let text = '';
      try {
        text = await extractResumeText(buffer, resume.mime);
      } catch (err) {
        const aiProvider = this.config.get('ai', { infer: true }).provider;
        // Gemini multimodal vẫn đọc được PDF/ảnh dù OCR cục bộ fail.
        if (aiProvider === 'gemini' && /pdf|image\//i.test(resume.mime)) {
          this.logger.warn(
            `Trích text cục bộ thất bại (${String(err).slice(0, 120)}); gửi file gốc cho Gemini.`,
          );
          text = '';
        } else {
          const message =
            err instanceof ExtractTextError
              ? err.message
              : `Không đọc được nội dung CV: ${String(err).slice(0, 300)}`;
          throw new Error(message);
        }
      }

      if (!text.trim()) {
        const aiProvider = this.config.get('ai', { infer: true }).provider;
        if (aiProvider === 'mock') {
          this.logger.warn(
            `Không trích được text từ CV "${resume.fileName}" (mime=${resume.mime}); AI mock sẽ suy luận từ tên file.`,
          );
        } else if (aiProvider === 'gemini' && /pdf|image\//i.test(resume.mime)) {
          this.logger.warn(
            `Text CV trống — Gemini sẽ đọc multimodal từ file "${resume.fileName}".`,
          );
        } else {
          throw new Error(
            'Không trích được nội dung CV từ file. Vui lòng tải PDF/DOCX/TXT có chữ (không phải ảnh scan) hoặc kiểm tra file bị hỏng.',
          );
        }
      }

      const parsed = await this.ai.parseResume({
        fileName: resume.fileName,
        text,
        fileBytes: buffer,
        mimeType: resume.mime,
      });

      const profileData = buildProfileDataFromParsed(parsed);

      // 1) Hồ sơ nghề nghiệp — map đầy đủ trường Sales B2B
      await this.prisma.candidateProfile.upsert({
        where: { candidateId },
        create: {
          candidateId,
          ...profileData,
        },
        update: profileData,
      });

      // Cập nhật displayName nếu AI đọc được họ tên
      if (parsed.contact.fullName && parsed.contact.fullName.length >= 3) {
        await this.prisma.candidate.update({
          where: { id: candidateId },
          data: { displayName: parsed.contact.fullName },
        });
      }

      // 2) Kỹ năng (chuẩn hoá về skill_id khi có trong Taxonomy) + soft skills
      await this.prisma.candidateSkill.deleteMany({ where: { candidateId } });
      const skillNames = new Set<string>();
      for (const skill of parsed.skills) {
        skillNames.add(skill.name.toLowerCase());
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
      for (const soft of parsed.softSkills.slice(0, 12)) {
        if (skillNames.has(soft.toLowerCase())) continue;
        await this.prisma.candidateSkill.create({
          data: {
            candidateId,
            name: soft,
            level: 'intermediate',
            yearsOfExperience: null,
          },
        });
      }

      // 2b) Kinh nghiệm theo công ty — đủ KPI / giai đoạn bán / mô tả
      await this.prisma.candidateExperience.deleteMany({ where: { candidateId } });
      for (const [idx, exp] of parsed.experiences.slice(0, 12).entries()) {
        await this.prisma.candidateExperience.create({
          data: buildExperienceRowFromParsed(candidateId, exp, idx),
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
        parsed.productsSold.join(', '),
        parsed.industriesExperienced.join(', '),
      ]
        .filter(Boolean)
        .join('. ');
      await this.saveEmbedding(aiProfile.candidateId, embeddingText);

      // 4) Cập nhật trạng thái ứng viên + % hoàn thiện thật
      const refreshed = await this.prisma.candidate.findUnique({
        where: { id: candidateId },
        include: {
          profile: true,
          aiProfile: true,
          skills: true,
          experiences: true,
        },
      });
      const profileCompletion = refreshed
        ? computeProfileCompletion(refreshed)
        : 80;

      await this.prisma.candidate.update({
        where: { id: candidateId },
        data: { status: CandidateStatus.Completed, profileCompletion },
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
          description: `Nhận diện ${parsed.skills.length} kỹ năng, ${parsed.experiences.length} công ty, ${parsed.education.length} học vấn — ngành ${parsed.industry ?? 'N/A'}.`,
        },
      });

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

      this.logger.log(
        `Hoàn tất phân tích CV resumeId=${resumeId} skills=${parsed.skills.length} exps=${parsed.experiences.length} edu=${parsed.education.length}`,
      );
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
      this.logger.warn(`Bỏ qua lưu embedding cho ${candidateId}: ${String(err)}`);
    }
  }
}
