import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

/**
 * Chuẩn hoá kỹ năng theo Taxonomy (Knowledge Domain).
 * Nghiệp vụ không lưu text tự do - luôn ánh xạ về skill_id chuẩn khi có thể.
 */
@Injectable()
export class SkillService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<{ id: string; code: string; name: string; category: string | null }[]> {
    const skills = await this.prisma.skill.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, code: true, name: true, category: true },
    });
    return skills;
  }

  /** Tìm skill_id chuẩn theo tên hoặc alias. Trả null nếu chưa có trong taxonomy. */
  async resolveSkillId(name: string): Promise<string | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const skill = await this.prisma.skill.findFirst({
      where: {
        OR: [
          { name: { equals: trimmed, mode: 'insensitive' } },
          { slug: { equals: trimmed.toLowerCase().replace(/\s+/g, '-') } },
          { aliases: { has: trimmed } },
        ],
      },
      select: { id: true },
    });
    return skill?.id ?? null;
  }
}
