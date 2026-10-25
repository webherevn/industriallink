import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ConnectionChatMessage,
  ConnectionChatThread,
} from '@industriallink/contracts';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { EmailService } from '../../shared/infrastructure/email/email.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { CompanyService } from '../company/company.service';
import { NotificationService } from '../notification/notification.service';

const PREVIEW = 160;

type ChatSide = 'candidate' | 'company';

type ChatRow = {
  id: string;
  tenantId: string;
  companyId: string;
  candidateId: string;
  requestedByUserId: string;
  status: string;
  candidateReadAt: Date | null;
  companyReadAt: Date | null;
  company: { name: string };
  candidate: {
    id: string;
    displayName: string;
    userId: string;
    user: { email: string; displayName: string } | null;
    profile: { currentPosition: string | null } | null;
  };
  requester: { id: string; email: string; displayName: string };
};

@Injectable()
export class ConnectionChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companies: CompanyService,
    private readonly email: EmailService,
    private readonly notifications: NotificationService,
  ) {}

  async listThreads(user: AuthenticatedUser): Promise<ConnectionChatThread[]> {
    const candidate = await this.prisma.candidate.findFirst({
      where: { userId: user.id, isDeleted: false },
      select: { id: true },
    });
    let companyId: string | null = null;
    try {
      companyId = (await this.companies.requireUserCompany(user.id)).companyId;
    } catch {
      companyId = null;
    }
    if (!candidate && !companyId) return [];

    const rows = await this.prisma.candidateConnection.findMany({
      where: {
        status: 'accepted',
        OR: [
          ...(candidate ? [{ candidateId: candidate.id }] : []),
          ...(companyId ? [{ companyId }] : []),
        ],
      },
      orderBy: { updatedAt: 'desc' },
      include: chatInclude,
    });

    const threads: ConnectionChatThread[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      const side: ChatSide = row.candidate.userId === user.id ? 'candidate' : 'company';
      const last = row.messages[0] ?? null;
      const readAt = side === 'candidate' ? row.candidateReadAt : row.companyReadAt;
      const unread = await this.prisma.connectionMessage.count({
        where: {
          connectionId: row.id,
          senderUserId: { not: user.id },
          ...(readAt ? { createdAt: { gt: readAt } } : {}),
        },
      });
      threads.push({
        connectionId: row.id,
        peerName: side === 'candidate' ? row.company.name : row.candidate.displayName,
        peerHint:
          side === 'candidate'
            ? 'Nhà tuyển dụng'
            : row.candidate.profile?.currentPosition ?? null,
        lastBody: last?.body ?? null,
        lastAt: last ? last.createdAt.toISOString() : null,
        unread,
      });
    }
    return threads.sort((a, b) => {
      const ta = a.lastAt ? Date.parse(a.lastAt) : 0;
      const tb = b.lastAt ? Date.parse(b.lastAt) : 0;
      return tb - ta;
    });
  }

  async listMessages(
    user: AuthenticatedUser,
    connectionId: string,
  ): Promise<ConnectionChatMessage[]> {
    const { row, side } = await this.requireAccess(user, connectionId);
    const latest = await this.prisma.connectionMessage.findMany({
      where: { connectionId: row.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const messages = latest.reverse();
    await this.prisma.candidateConnection.update({
      where: { id: row.id },
      data: side === 'candidate' ? { candidateReadAt: new Date() } : { companyReadAt: new Date() },
    });
    return messages.map((m) => ({
      id: m.id,
      connectionId: m.connectionId,
      body: m.body,
      mine: m.senderUserId === user.id,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async sendMessage(
    user: AuthenticatedUser,
    connectionId: string,
    body: string,
  ): Promise<ConnectionChatMessage> {
    const text = body.trim();
    if (!text) throw new BadRequestException('Nhập nội dung tin nhắn');
    if (text.length > 2000) throw new BadRequestException('Tin nhắn tối đa 2000 ký tự');

    const { row, side } = await this.requireAccess(user, connectionId);
    const message = await this.prisma.connectionMessage.create({
      data: {
        connectionId: row.id,
        senderUserId: user.id,
        body: text,
      },
    });
    await this.prisma.candidateConnection.update({
      where: { id: row.id },
      data:
        side === 'candidate'
          ? { candidateReadAt: new Date() }
          : { companyReadAt: new Date() },
    });

    const recipient =
      side === 'candidate'
        ? { userId: row.requester.id, email: row.requester.email, name: row.requester.displayName }
        : {
            userId: row.candidate.userId,
            email: row.candidate.user?.email ?? '',
            name: row.candidate.displayName,
          };
    const senderName = side === 'candidate' ? row.candidate.displayName : row.company.name;
    const excerpt = text.length > PREVIEW ? `${text.slice(0, PREVIEW)}…` : text;
    const link =
      side === 'candidate'
        ? `${this.email.webOrigin}/candidates/${row.candidate.id}`
        : `${this.email.webOrigin}/connections`;

    if (recipient.email) {
      await this.email.sendSafe({
        to: recipient.email,
        subject: `${senderName} vừa nhắn cho bạn trên inlink`,
        text: `${senderName}: ${excerpt}\n\nMở inlink để trả lời: ${link}`,
        html: `<p><strong>${escapeHtml(senderName)}</strong> vừa gửi tin nhắn:</p><p>${escapeHtml(excerpt)}</p><p><a href="${escapeHtml(link)}">Mở inlink để trả lời</a></p>`,
      });
    }
    await this.notifications.createInApp({
      tenantId: row.tenantId,
      userId: recipient.userId,
      type: 'connection.message',
      title: `${senderName} vừa nhắn tin`,
      body: excerpt,
      link: side === 'candidate' ? `/candidates/${row.candidate.id}` : '/connections',
      entityType: 'connection',
      entityId: row.id,
    });

    return {
      id: message.id,
      connectionId: message.connectionId,
      body: message.body,
      mine: true,
      createdAt: message.createdAt.toISOString(),
    };
  }

  private async requireAccess(
    user: AuthenticatedUser,
    connectionId: string,
  ): Promise<{ row: ChatRow; side: ChatSide }> {
    const row = await this.prisma.candidateConnection.findFirst({
      where: { id: connectionId },
      include: {
        company: { select: { name: true } },
        candidate: {
          select: {
            id: true,
            displayName: true,
            userId: true,
            user: { select: { email: true, displayName: true } },
            profile: { select: { currentPosition: true } },
          },
        },
        requester: { select: { id: true, email: true, displayName: true } },
      },
    });
    if (!row) throw new NotFoundException('Không tìm thấy kết nối');
    if (row.status !== 'accepted') {
      throw new ForbiddenException('Chỉ nhắn tin sau khi đã kết nối');
    }
    if (row.candidate.userId === user.id) return { row, side: 'candidate' };
    const member = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId: row.companyId, userId: user.id } },
      select: { id: true },
    });
    if (!member) throw new ForbiddenException('Bạn không ở trong cuộc kết nối này');
    return { row, side: 'company' };
  }
}

const chatInclude = {
  company: { select: { name: true } },
  candidate: {
    select: {
      displayName: true,
      userId: true,
      profile: { select: { currentPosition: true } },
    },
  },
  messages: { orderBy: { createdAt: 'desc' as const }, take: 1 },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
