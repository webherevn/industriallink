import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  B2B_EXPERIENCE_BAND_LABEL,
  CompanyStatus,
  JOB_READINESS_LABEL,
  JobStatus,
  companyPublicPath,
  formatCompanySize,
  formatJobLevel,
  formatJobTitle,
  type ConnectionChatMessage,
  type ConnectionChatProfile,
  type ConnectionChatThread,
} from '@industriallink/contracts';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { EmailService } from '../../shared/infrastructure/email/email.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { CompanyService } from '../company/company.service';
import { NotificationService } from '../notification/notification.service';
import { candidateAcceptsOutreachEmail } from './outreach-email';

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

    const companyIds = [...new Set(rows.map((row) => row.companyId))];
    const openJobs = companyIds.length
      ? await this.prisma.job.groupBy({
          by: ['companyId'],
          where: {
            companyId: { in: companyIds },
            isDeleted: false,
            status: JobStatus.Published,
            company: { status: CompanyStatus.Active, isDeleted: false },
          },
          _count: { _all: true },
        })
      : [];
    const openJobCount = new Map(openJobs.map((row) => [row.companyId, row._count._all]));

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
      const profile = chatProfile(side, row, openJobCount.get(row.companyId) ?? 0);
      threads.push({
        connectionId: row.id,
        peerName: side === 'candidate' ? row.company.name : row.candidate.displayName,
        peerHint: profile.headline,
        lastBody: last?.body ?? null,
        lastAt: last ? last.createdAt.toISOString() : null,
        unread,
        profile,
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

    const emailCandidate =
      side !== 'company' || (await candidateAcceptsOutreachEmail(this.prisma, recipient.userId));
    if (recipient.email && emailCandidate) {
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
  company: {
    select: {
      id: true,
      name: true,
      slug: true,
      industry: true,
      size: true,
      address: true,
      description: true,
      profile: true,
    },
  },
  candidate: {
    select: {
      id: true,
      displayName: true,
      userId: true,
      profile: {
        select: {
          currentPosition: true,
          jobLevel: true,
          totalExperienceYears: true,
          industry: true,
          industriesExperienced: true,
          summary: true,
          b2bExperienceBand: true,
          currentCity: true,
          desiredLocations: true,
          expectedSalaryMin: true,
          expectedSalaryMax: true,
          jobReadiness: true,
          educationLevel: true,
          educationSchool: true,
        },
      },
      skills: { select: { name: true }, orderBy: { name: 'asc' as const }, take: 6 },
      experiences: {
        where: { isCurrent: true },
        orderBy: { sortOrder: 'asc' as const },
        take: 1,
        select: { companyName: true, jobTitle: true },
      },
    },
  },
  messages: { orderBy: { createdAt: 'desc' as const }, take: 1 },
};

type ChatListRow = {
  companyId: string;
  company: {
    id: string;
    name: string;
    slug: string | null;
    industry: string | null;
    size: string | null;
    address: string | null;
    description: string | null;
    profile: unknown;
  };
  candidate: {
    id: string;
    displayName: string;
    profile: {
      currentPosition: string | null;
      jobLevel: string | null;
      totalExperienceYears: number | null;
      industry: string | null;
      industriesExperienced: string[];
      summary: string | null;
      b2bExperienceBand: string | null;
      currentCity: string | null;
      desiredLocations: string[];
      expectedSalaryMin: number | null;
      expectedSalaryMax: number | null;
      jobReadiness: string | null;
      educationLevel: string | null;
      educationSchool: string | null;
    } | null;
    skills: { name: string }[];
    experiences: { companyName: string; jobTitle: string }[];
  };
};

function chatProfile(side: ChatSide, row: ChatListRow, openJobs: number): ConnectionChatProfile {
  if (side === 'candidate') return companyChatProfile(row, openJobs);
  return candidateChatProfile(row);
}

function candidateChatProfile(row: ChatListRow): ConnectionChatProfile {
  const profile = row.candidate.profile;
  const facts: ConnectionChatProfile['facts'] = [];
  pushFact(facts, 'Cấp bậc', profile?.jobLevel ? formatJobLevel(profile.jobLevel) : null);
  pushFact(
    facts,
    'Kinh nghiệm',
    yearsText(profile?.totalExperienceYears ?? null) ??
      bandLabel(B2B_EXPERIENCE_BAND_LABEL, profile?.b2bExperienceBand ?? null),
  );
  pushFact(facts, 'Ngành', profile?.industry);
  const current = row.candidate.experiences[0];
  pushFact(facts, 'Công ty', current?.companyName);
  pushFact(facts, 'Khu vực', profile?.currentCity);
  pushFact(facts, 'Muốn làm tại', joinList(profile?.desiredLocations, 3));
  pushFact(
    facts,
    'Lương mong muốn',
    salaryRange(profile?.expectedSalaryMin ?? null, profile?.expectedSalaryMax ?? null),
  );
  pushFact(facts, 'Sẵn sàng', bandLabel(JOB_READINESS_LABEL, profile?.jobReadiness ?? null));
  pushFact(
    facts,
    'Học vấn',
    [profile?.educationLevel, profile?.educationSchool].filter(Boolean).join(' · ') || null,
  );
  const skillTags = row.candidate.skills.map((skill) => skill.name).filter(Boolean);
  const tags = skillTags.length > 0 ? skillTags : (profile?.industriesExperienced ?? []).slice(0, 4);
  const headline = profile?.currentPosition ? formatJobTitle(profile.currentPosition) : 'Ứng viên';
  return {
    kind: 'candidate',
    path: `/candidates/${row.candidate.id}`,
    headline,
    summary: clip(profile?.summary),
    facts,
    tags,
    logoCompanyId: null,
  };
}

function companyChatProfile(row: ChatListRow, openJobs: number): ConnectionChatProfile {
  const company = row.company;
  const brand = readBrand(company.profile);
  const facts: ConnectionChatProfile['facts'] = [];
  pushFact(facts, 'Ngành', company.industry);
  pushFact(facts, 'Quy mô', company.size ? formatCompanySize(company.size) : null);
  pushFact(facts, 'Địa điểm', company.address);
  pushFact(facts, 'Thành lập', brand.foundedYear ? String(brand.foundedYear) : null);
  pushFact(facts, 'Tin đang tuyển', openJobs > 0 ? `${openJobs} tin` : null);
  return {
    kind: 'company',
    path: companyPublicPath({ id: company.id, slug: company.slug }),
    headline: company.industry?.trim() || 'Nhà tuyển dụng',
    summary: clip(company.description),
    facts,
    tags: [],
    logoCompanyId: brand.hasLogo ? company.id : null,
  };
}

function pushFact(
  facts: ConnectionChatProfile['facts'],
  label: string,
  value: string | null | undefined,
) {
  const text = value?.trim();
  if (!text || text === '—') return;
  facts.push({ label, value: text });
}

function joinList(values: string[] | null | undefined, max: number): string | null {
  const items = (values ?? []).map((item) => item.trim()).filter(Boolean).slice(0, max);
  return items.length > 0 ? items.join(', ') : null;
}

function yearsText(years: number | null): string | null {
  if (years == null || !Number.isFinite(years) || years <= 0) return null;
  const text = Number.isInteger(years)
    ? years.toLocaleString('vi-VN')
    : years.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  return `${text} năm`;
}

function salaryRange(min: number | null, max: number | null): string | null {
  if (min != null && max != null) return min === max ? vnd(min) : `${vnd(min)} – ${vnd(max)}`;
  if (min != null) return `Từ ${vnd(min)}`;
  if (max != null) return `Đến ${vnd(max)}`;
  return null;
}

function vnd(amount: number): string {
  if (amount >= 1_000_000_000) {
    const ty = amount / 1_000_000_000;
    const text = Number.isInteger(ty)
      ? ty.toLocaleString('vi-VN')
      : ty.toLocaleString('vi-VN', { maximumFractionDigits: 2 });
    return `${text} tỷ`;
  }
  if (amount >= 1_000_000) {
    const tr = amount / 1_000_000;
    const text = Number.isInteger(tr)
      ? tr.toLocaleString('vi-VN')
      : tr.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
    return `${text} triệu`;
  }
  return `${Math.round(amount).toLocaleString('vi-VN')} đ`;
}

function bandLabel<T extends string>(map: Record<T, string>, value: string | null): string | null {
  if (!value || !(value in map)) return null;
  return map[value as T];
}

function clip(value: string | null | undefined): string | null {
  const text = value?.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > 180 ? `${text.slice(0, 180).trimEnd()}…` : text;
}

function readBrand(profile: unknown): { foundedYear: number | null; hasLogo: boolean } {
  if (!profile || typeof profile !== 'object') return { foundedYear: null, hasLogo: false };
  const brand = profile as { foundedYear?: unknown; logoStorageKey?: unknown };
  const year = brand.foundedYear;
  return {
    foundedYear: typeof year === 'number' && year >= 1900 && year <= 2100 ? year : null,
    hasLogo: typeof brand.logoStorageKey === 'string' && brand.logoStorageKey.length > 0,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
