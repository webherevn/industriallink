import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

export interface AuditEntry {
  tenantId: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  correlationId?: string | null;
}

/**
 * Ghi Audit Log cho mọi thay đổi dữ liệu quan trọng (không dùng DB trigger,
 * mỗi service chủ động ghi - chuẩn Chương 4.4.1 mục 7).
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        actorId: entry.actorId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        before: (entry.before ?? undefined) as never,
        after: (entry.after ?? undefined) as never,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
        correlationId: entry.correlationId ?? null,
      },
    });
  }
}
