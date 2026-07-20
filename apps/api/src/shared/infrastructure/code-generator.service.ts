import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

/**
 * Sinh Business Code dạng CAN-2026-000001 (chuẩn Chương 4.4.1 mục 22).
 * Dùng bảng shared.sequence để đảm bảo tăng dần và duy nhất theo prefix + năm.
 */
@Injectable()
export class CodeGeneratorService {
  constructor(private readonly prisma: PrismaService) {}

  async next(prefix: string): Promise<string> {
    const year = new Date().getFullYear();
    const key = `${prefix}-${year}`;
    const seq = await this.prisma.sequence.upsert({
      where: { key },
      create: { key, value: 1n },
      update: { value: { increment: 1n } },
    });
    const padded = seq.value.toString().padStart(6, '0');
    return `${prefix}-${year}-${padded}`;
  }
}
