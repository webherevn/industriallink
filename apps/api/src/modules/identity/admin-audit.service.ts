import { Injectable } from '@nestjs/common';
import type { AuditLogItem, AuditLogListPage, AuditLogListQuery } from '@industriallink/contracts';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AuditLogListQuery = {}): Promise<AuditLogListPage> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(query.limit ?? 40, 1), 100);
    const q = query.q?.trim();
    const where: Prisma.AuditLogWhereInput = {};
    if (query.entityType) where.entityType = query.entityType;
    if (query.action) where.action = { contains: query.action, mode: 'insensitive' };
    if (q) {
      const actors = await this.prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: q, mode: 'insensitive' } },
            { displayName: { contains: q, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
        take: 20,
      });
      where.AND = [
        {
          OR: [
            { action: { contains: q, mode: 'insensitive' } },
            { entityType: { contains: q, mode: 'insensitive' } },
            { entityId: { contains: q, mode: 'insensitive' } },
            ...(actors.length ? [{ actorId: { in: actors.map((a) => a.id) } }] : []),
          ],
        },
      ];
    }

    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    const actorIds = [...new Set(rows.map((r) => r.actorId).filter((id): id is string => Boolean(id)))];
    const users = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, email: true, displayName: true },
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    const items: AuditLogItem[] = rows.map((row) => {
      const actor = row.actorId ? byId.get(row.actorId) : undefined;
      return {
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        actorId: row.actorId,
        actorEmail: actor?.email ?? null,
        actorName: actor?.displayName ?? null,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        before: row.before ?? null,
        after: row.after ?? null,
        ip: row.ip,
        correlationId: row.correlationId,
      };
    });
    return { items, total, page, limit };
  }
}
