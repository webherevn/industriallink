import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  isCrmRole,
  UserRole,
  type SupportChatMessageView,
  type SupportChatPromptView,
  type SupportChatThreadView,
  type SupportChatView,
} from '@industriallink/contracts';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { NotificationService } from '../notification/notification.service';

const STAFF_ROLES = [UserRole.SuperAdmin, UserRole.Sales, UserRole.SalesManager];

@Injectable()
export class SupportChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  async mine(user: AuthenticatedUser, markRead: boolean): Promise<SupportChatView> {
    const chat = await this.prisma.supportChat.findUnique({
      where: { userId: user.id },
      include: messageInclude,
    });
    if (!chat) return { messages: [], unread: 0 };
    const unread = this.unreadForUser(chat);
    if (markRead) {
      await this.prisma.supportChat.update({
        where: { id: chat.id },
        data: { userReadAt: new Date() },
      });
    }
    return {
      messages: [...chat.messages].reverse().map((message) => this.toMessage(message, user.id)),
      unread: markRead ? 0 : unread,
    };
  }

  async sendAsUser(user: AuthenticatedUser, body: string): Promise<SupportChatMessageView> {
    const text = this.clean(body);
    const chat = await this.prisma.supportChat.upsert({
      where: { userId: user.id },
      create: { userId: user.id, userReadAt: new Date() },
      update: { userReadAt: new Date() },
    });
    const message = await this.prisma.supportChatMessage.create({
      data: { chatId: chat.id, senderUserId: user.id, body: text },
      include: { sender: { select: { id: true, displayName: true, role: true } } },
    });
    await this.notifyStaff(user, text, chat.id);
    return this.toMessage(message, user.id);
  }

  async threads(): Promise<SupportChatThreadView[]> {
    const rows = await this.prisma.supportChat.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { displayName: true, email: true, role: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    const result: SupportChatThreadView[] = [];
    for (const row of rows) {
      const unread = await this.prisma.supportChatMessage.count({
        where: {
          chatId: row.id,
          sender: { role: { notIn: STAFF_ROLES } },
          ...(row.staffReadAt ? { createdAt: { gt: row.staffReadAt } } : {}),
        },
      });
      const last = row.messages[0] ?? null;
      result.push({
        id: row.id,
        name: row.user.displayName,
        email: row.user.email,
        roleLabel: roleLabel(row.user.role),
        lastBody: last?.body ?? null,
        lastAt: last ? last.createdAt.toISOString() : null,
        unread,
      });
    }
    return result.sort((a, b) => (b.lastAt ? Date.parse(b.lastAt) : 0) - (a.lastAt ? Date.parse(a.lastAt) : 0));
  }

  async threadMessages(chatId: string): Promise<SupportChatMessageView[]> {
    const chat = await this.prisma.supportChat.findUnique({
      where: { id: chatId },
      include: messageInclude,
    });
    if (!chat) throw new NotFoundException('Không tìm thấy hội thoại');
    await this.prisma.supportChat.update({
      where: { id: chat.id },
      data: { staffReadAt: new Date() },
    });
    return [...chat.messages].reverse().map((message) => this.toMessage(message, chat.userId));
  }

  async reply(staff: AuthenticatedUser, chatId: string, body: string): Promise<SupportChatMessageView> {
    const text = this.clean(body);
    const chat = await this.prisma.supportChat.findUnique({
      where: { id: chatId },
      include: { user: { select: { id: true, tenantId: true, displayName: true } } },
    });
    if (!chat) throw new NotFoundException('Không tìm thấy hội thoại');
    const message = await this.prisma.supportChatMessage.create({
      data: { chatId: chat.id, senderUserId: staff.id, body: text },
      include: { sender: { select: { id: true, displayName: true, role: true } } },
    });
    await this.prisma.supportChat.update({
      where: { id: chat.id },
      data: { staffReadAt: new Date() },
    });
    await this.notifySafe({
      tenantId: chat.user.tenantId,
      userId: chat.user.id,
      type: 'support.reply',
      title: 'inlink đã trả lời bạn',
      body: excerpt(text),
      link: null,
      entityType: 'support_chat',
      entityId: chat.id,
    });
    return { ...this.toMessage(message, chat.userId), mine: true };
  }

  async prompts(): Promise<SupportChatPromptView[]> {
    const row = await this.prisma.supportChatPromptSetting.findUnique({ where: { id: 'default' } });
    if (!row) return this.seedPrompts();
    return parsePrompts(row.lines);
  }

  async addPrompt(body: string): Promise<SupportChatPromptView[]> {
    const lines = await this.prompts();
    if (lines.length >= 20) throw new BadRequestException('Tối đa 20 câu chào');
    return this.savePrompts([...lines, { id: randomUUID(), body: this.cleanPrompt(body) }]);
  }

  async updatePrompt(id: string, body: string): Promise<SupportChatPromptView[]> {
    const lines = await this.prompts();
    if (!lines.some((line) => line.id === id)) throw new NotFoundException('Không tìm thấy câu chào');
    const text = this.cleanPrompt(body);
    return this.savePrompts(lines.map((line) => (line.id === id ? { ...line, body: text } : line)));
  }

  async deletePrompt(id: string): Promise<SupportChatPromptView[]> {
    const lines = await this.prompts();
    if (!lines.some((line) => line.id === id)) throw new NotFoundException('Không tìm thấy câu chào');
    return this.savePrompts(lines.filter((line) => line.id !== id));
  }

  private async seedPrompts(): Promise<SupportChatPromptView[]> {
    const lines = DEFAULT_PROMPTS.map((body) => ({ id: randomUUID(), body }));
    try {
      await this.prisma.supportChatPromptSetting.create({
        data: { id: 'default', lines: lines as unknown as Prisma.InputJsonValue },
      });
      return lines;
    } catch {
      const row = await this.prisma.supportChatPromptSetting.findUnique({ where: { id: 'default' } });
      return row ? parsePrompts(row.lines) : lines;
    }
  }

  private async savePrompts(lines: SupportChatPromptView[]): Promise<SupportChatPromptView[]> {
    await this.prisma.supportChatPromptSetting.upsert({
      where: { id: 'default' },
      create: { id: 'default', lines: lines as unknown as Prisma.InputJsonValue },
      update: { lines: lines as unknown as Prisma.InputJsonValue },
    });
    return lines;
  }

  private cleanPrompt(body: string): string {
    const text = body.trim();
    if (!text) throw new BadRequestException('Nhập câu chào');
    if (text.length > 300) throw new BadRequestException('Câu chào tối đa 300 ký tự');
    return text;
  }

  private clean(body: string): string {
    const text = body.trim();
    if (!text) throw new BadRequestException('Nhập nội dung');
    if (text.length > 2000) throw new BadRequestException('Nội dung tối đa 2000 ký tự');
    return text;
  }

  private unreadForUser(chat: {
    userReadAt: Date | null;
    messages: { createdAt: Date; sender: { role: string } }[];
  }): number {
    return chat.messages.filter(
      (message) =>
        isCrmRole(message.sender.role) &&
        (!chat.userReadAt || message.createdAt > chat.userReadAt),
    ).length;
  }

  private toMessage(
    message: {
      id: string;
      body: string;
      createdAt: Date;
      senderUserId: string;
      sender: { displayName: string; role: string };
    },
    ownerUserId: string,
  ): SupportChatMessageView {
    const fromStaff = isCrmRole(message.sender.role);
    return {
      id: message.id,
      body: message.body,
      mine: message.senderUserId === ownerUserId,
      fromStaff,
      senderName: message.sender.displayName,
      createdAt: message.createdAt.toISOString(),
    };
  }

  private async notifyStaff(user: AuthenticatedUser, text: string, chatId: string): Promise<void> {
    const staff = await this.prisma.user.findMany({
      where: { isDeleted: false, role: { in: STAFF_ROLES }, id: { not: user.id } },
      select: { id: true, tenantId: true },
    });
    await Promise.all(
      staff.map((person) =>
        this.notifySafe({
          tenantId: person.tenantId,
          userId: person.id,
          type: 'support.message',
          title: `${user.displayName} vừa gửi góp ý`,
          body: excerpt(text),
          link: '/crm/chat',
          entityType: 'support_chat',
          entityId: chatId,
        }),
      ),
    );
  }

  private async notifySafe(input: Parameters<NotificationService['createInApp']>[0]): Promise<void> {
    try {
      await this.notifications.createInApp(input);
    } catch {
      // Thông báo lỗi không chặn tin nhắn.
    }
  }
}

const messageInclude = {
  messages: {
    orderBy: { createdAt: 'desc' as const },
    take: 200,
    include: { sender: { select: { id: true, displayName: true, role: true } } },
  },
};

function roleLabel(role: string): string {
  if (role === UserRole.Candidate) return 'Ứng viên';
  if (role === UserRole.Recruiter || role === UserRole.HiringManager || role === UserRole.CompanyAdmin) {
    return 'Nhà tuyển dụng';
  }
  if (role === UserRole.Sales || role === UserRole.SalesManager) return 'Kinh doanh';
  if (role === UserRole.SuperAdmin) return 'SuperAdmin';
  return 'Người dùng';
}

function excerpt(text: string): string {
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

const DEFAULT_PROMPTS = [
  'Hi, {ten}, cần tôi giúp gì cho bạn?',
  'Bạn đang khó khăn phần nào? Hãy chatbox để Inlink hướng dẫn?',
  'Inlink vẫn đang trong giai đoạn trải nghiệm và thử nghiệm chắc chắn sẽ có một vài lỗi/thiếu sót, mong bạn thông cảm và gửi góp ý cho đội ngũ nhé.',
];

function parsePrompts(value: unknown): SupportChatPromptView[] {
  if (!Array.isArray(value)) return [];
  const lines: SupportChatPromptView[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const id = String(rec.id ?? '').trim();
    const body = String(rec.body ?? '').trim();
    if (!id || !body) continue;
    lines.push({ id, body });
  }
  return lines;
}
