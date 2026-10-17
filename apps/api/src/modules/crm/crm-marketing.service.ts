import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { UserRole, type CreateCrmCampaignRequest, type CreateCrmMarketingChannelRequest, type CreateCrmMarketingCostRequest, type CrmMarketingOverview, type UpdateCrmCampaignRequest, type UpdateCrmMarketingChannelRequest } from '@industriallink/contracts';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { campaignStatus, channelCode, dayAccepted, dayKey, parseDay, parseVnd, vndAccepted } from './marketing-input';

const UUID = /^[0-9a-f-]{36}$/i;

/** Kênh chuẩn. Dòng thiếu được thêm khi mở marketing, không ghi đè kênh đã tắt. */
const STANDARD_CHANNELS: { code: string; name: string; groupCode: 'owned' | 'social'; sortOrder: number }[] = [
  { code: 'web', name: 'Web', groupCode: 'owned', sortOrder: 10 },
  { code: 'zalo', name: 'Zalo', groupCode: 'owned', sortOrder: 20 },
  { code: 'event', name: 'Sự kiện', groupCode: 'owned', sortOrder: 30 },
  { code: 'partner', name: 'Cộng tác viên', groupCode: 'owned', sortOrder: 40 },
  { code: 'facebook', name: 'Facebook', groupCode: 'social', sortOrder: 50 },
  { code: 'instagram', name: 'Instagram', groupCode: 'social', sortOrder: 60 },
  { code: 'tiktok', name: 'TikTok', groupCode: 'social', sortOrder: 70 },
  { code: 'linkedin', name: 'LinkedIn', groupCode: 'social', sortOrder: 80 },
  { code: 'x', name: 'X', groupCode: 'social', sortOrder: 90 },
  { code: 'youtube', name: 'YouTube', groupCode: 'social', sortOrder: 100 },
];

function clip(value: string | null | undefined, max: number): string {
  return (value ?? '').trim().slice(0, max);
}

@Injectable()
export class CrmMarketingService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(actor: AuthenticatedUser): Promise<CrmMarketingOverview> {
    await this.ensureStandardChannels();
    const own = this.own(actor);
    const [channels, campaigns, costs] = await Promise.all([
      this.prisma.crmMarketingChannel.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      this.prisma.crmCampaign.findMany({
        where: own,
        include: { channel: { select: { name: true, groupCode: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.crmMarketingCost.findMany({
        where: own ? { campaign: own } : {},
        include: {
          campaign: { select: { name: true, campaignCode: true } },
          channel: { select: { name: true } },
        },
        orderBy: [{ spentOn: 'desc' }, { createdAt: 'desc' }],
        take: 200,
      }),
    ]);
    const names = await this.ownerNames(campaigns.map((row) => row.ownerUserId));
    const spentByCampaign = new Map<string, bigint>();
    const visibleIds = campaigns.map((row) => row.id);
    if (visibleIds.length > 0) {
      const sums = await this.prisma.crmMarketingCost.groupBy({
        by: ['campaignId'],
        where: { campaignId: { in: visibleIds } },
        _sum: { amountVnd: true },
      });
      for (const row of sums) spentByCampaign.set(row.campaignId, row._sum.amountVnd ?? 0n);
    }
    let budget = 0n;
    let spent = 0n;
    const mapped = campaigns.map((row) => {
      const rowSpent = spentByCampaign.get(row.id) ?? 0n;
      if (row.status !== 'cancelled') {
        budget += row.budgetVnd ?? 0n;
        spent += rowSpent;
      }
      return {
        id: row.id,
        campaignCode: row.campaignCode,
        name: row.name,
        channelId: row.channelId,
        channelName: row.channel.name,
        channelGroup: this.group(row.channel.groupCode),
        status: campaignStatus(row.status) ?? 'draft',
        startsOn: dayKey(row.startsOn),
        endsOn: dayKey(row.endsOn),
        budgetVnd: row.budgetVnd?.toString() ?? null,
        spentVnd: rowSpent.toString(),
        ownerUserId: row.ownerUserId,
        ownerName: names.get(row.ownerUserId) ?? 'Người phụ trách',
        note: row.note,
        createdAt: row.createdAt.toISOString(),
      };
    });
    return {
      canManageSpend: this.seesAll(actor),
      budgetVnd: budget.toString(),
      spentVnd: spent.toString(),
      activeCount: campaigns.filter((row) => row.status === 'active').length,
      campaignCount: campaigns.length,
      channels: channels.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        group: this.group(row.groupCode),
        isActive: row.isActive,
        sortOrder: row.sortOrder,
      })),
      campaigns: mapped,
      costs: costs.map((row) => ({
        id: row.id,
        campaignId: row.campaignId,
        campaignName: row.campaign.name,
        campaignCode: row.campaign.campaignCode,
        channelId: row.channelId,
        channelName: row.channel.name,
        spentOn: dayKey(row.spentOn) ?? '',
        amountVnd: row.amountVnd.toString(),
        note: row.note,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async createChannel(actor: AuthenticatedUser, input: CreateCrmMarketingChannelRequest) {
    this.assertSpend(actor);
    const name = clip(input.name, 40);
    if (name.length < 2) throw new BadRequestException('Tên kênh cần ít nhất 2 ký tự');
    const group = input.group === 'owned' || input.group === 'social' ? input.group : null;
    if (!group) throw new BadRequestException('Chọn nhóm kênh');
    const base = channelCode(name);
    let code = base;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const taken = await this.prisma.crmMarketingChannel.findUnique({ where: { code }, select: { id: true } });
      if (!taken) break;
      code = `${base}-${randomBytes(1).toString('hex')}`;
      if (attempt === 4) throw new BadRequestException('Chưa tạo được mã kênh, thử lại');
    }
    const last = await this.prisma.crmMarketingChannel.findFirst({ orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } });
    await this.prisma.crmMarketingChannel.create({
      data: { code, name, groupCode: group, sortOrder: (last?.sortOrder ?? 0) + 10 },
    });
    return this.overview(actor);
  }

  async updateChannel(actor: AuthenticatedUser, channelId: string, input: UpdateCrmMarketingChannelRequest) {
    this.assertSpend(actor);
    const channel = await this.requireChannel(channelId);
    if (typeof input.isActive !== 'boolean') throw new BadRequestException('Chọn trạng thái kênh');
    await this.prisma.crmMarketingChannel.update({ where: { id: channel.id }, data: { isActive: input.isActive } });
    return this.overview(actor);
  }

  async createCampaign(actor: AuthenticatedUser, input: CreateCrmCampaignRequest) {
    const name = clip(input.name, 120);
    if (name.length < 2) throw new BadRequestException('Tên chiến dịch cần ít nhất 2 ký tự');
    const status = campaignStatus(input.status ?? 'draft');
    if (!status) throw new BadRequestException('Trạng thái chiến dịch không hợp lệ');
    const channel = await this.requireChannel(input.channelId);
    if (!channel.isActive) throw new BadRequestException('Kênh này đang tắt');
    const dates = this.readDates(input.startsOn, input.endsOn);
    const budget = this.readBudget(actor, input.budgetVnd, null);
    const ownerUserId = await this.readOwner(actor, input.ownerUserId);
    await this.prisma.crmCampaign.create({
      data: {
        campaignCode: await this.nextCode(),
        name,
        channelId: channel.id,
        status,
        startsOn: dates.startsOn,
        endsOn: dates.endsOn,
        budgetVnd: budget,
        ownerUserId,
        note: clip(input.note, 500) || null,
      },
    });
    return this.overview(actor);
  }

  async updateCampaign(actor: AuthenticatedUser, campaignId: string, input: UpdateCrmCampaignRequest) {
    const current = await this.requireCampaign(actor, campaignId);
    const name = clip(input.name, 120);
    if (name.length < 2) throw new BadRequestException('Tên chiến dịch cần ít nhất 2 ký tự');
    const status = campaignStatus(input.status);
    if (!status) throw new BadRequestException('Trạng thái chiến dịch không hợp lệ');
    const channel = await this.requireChannel(input.channelId);
    if (!channel.isActive && channel.id !== current.channelId) throw new BadRequestException('Kênh này đang tắt');
    const dates = this.readDates(input.startsOn, input.endsOn);
    const budget = this.readBudget(actor, input.budgetVnd, current.budgetVnd);
    const ownerUserId = await this.readOwner(actor, input.ownerUserId ?? current.ownerUserId);
    await this.prisma.crmCampaign.update({
      where: { id: current.id },
      data: {
        name,
        channelId: channel.id,
        status,
        startsOn: dates.startsOn,
        endsOn: dates.endsOn,
        budgetVnd: budget,
        ownerUserId,
        note: clip(input.note, 500) || null,
      },
    });
    return this.overview(actor);
  }

  async createCost(actor: AuthenticatedUser, input: CreateCrmMarketingCostRequest) {
    this.assertSpend(actor);
    if (!UUID.test(input.campaignId ?? '')) throw new NotFoundException('Không tìm thấy chiến dịch');
    const campaign = await this.prisma.crmCampaign.findUnique({ where: { id: input.campaignId } });
    if (!campaign) throw new NotFoundException('Không tìm thấy chiến dịch');
    const channel = await this.requireChannel(input.channelId || campaign.channelId);
    if (!vndAccepted(input.amountVnd) || parseVnd(input.amountVnd) == null || parseVnd(input.amountVnd)! <= 0n) {
      throw new BadRequestException('Số tiền là số nguyên VND lớn hơn 0');
    }
    if (!dayAccepted(input.spentOn) || !parseDay(input.spentOn)) throw new BadRequestException('Chọn ngày chi');
    await this.prisma.crmMarketingCost.create({
      data: {
        campaignId: campaign.id,
        channelId: channel.id,
        spentOn: parseDay(input.spentOn)!,
        amountVnd: parseVnd(input.amountVnd)!,
        note: clip(input.note, 500) || null,
        createdByUserId: actor.id,
      },
    });
    return this.overview(actor);
  }

  async deleteCost(actor: AuthenticatedUser, costId: string) {
    this.assertSpend(actor);
    if (!UUID.test(costId)) throw new NotFoundException('Không tìm thấy khoản chi');
    const cost = await this.prisma.crmMarketingCost.findUnique({ where: { id: costId }, select: { id: true } });
    if (!cost) throw new NotFoundException('Không tìm thấy khoản chi');
    await this.prisma.crmMarketingCost.delete({ where: { id: cost.id } });
    return this.overview(actor);
  }

  /** Sale chỉ gắn chiến dịch của mình. SuperAdmin gắn được mọi chiến dịch chưa hủy. */
  async campaignIdFor(actor: AuthenticatedUser, campaignId: string | null): Promise<string | null> {
    if (!campaignId) return null;
    if (!UUID.test(campaignId)) throw new BadRequestException('Không tìm thấy chiến dịch');
    const campaign = await this.prisma.crmCampaign.findUnique({ where: { id: campaignId }, select: { id: true, ownerUserId: true, status: true } });
    if (!campaign || campaign.status === 'cancelled') throw new BadRequestException('Chiến dịch không còn để gắn');
    if (!this.seesAll(actor) && campaign.ownerUserId !== actor.id) {
      throw new ForbiddenException('Chiến dịch này thuộc người phụ trách khác');
    }
    return campaign.id;
  }

  private readDates(startsOn: string | null | undefined, endsOn: string | null | undefined) {
    if (!dayAccepted(startsOn) || !dayAccepted(endsOn)) throw new BadRequestException('Ngày chạy không hợp lệ');
    const start = parseDay(startsOn);
    const end = parseDay(endsOn);
    if (start && end && end < start) throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    return { startsOn: start ?? null, endsOn: end ?? null };
  }

  private readBudget(actor: AuthenticatedUser, value: string | null | undefined, current: bigint | null): bigint | null {
    if (!vndAccepted(value)) throw new BadRequestException('Ngân sách là số nguyên VND');
    const next = value === undefined ? current : parseVnd(value);
    if (next === undefined) throw new BadRequestException('Ngân sách là số nguyên VND');
    if (!this.seesAll(actor) && next !== current) throw new ForbiddenException('Chỉ SuperAdmin đặt ngân sách');
    return next ?? null;
  }

  private async readOwner(actor: AuthenticatedUser, ownerUserId: string | null | undefined): Promise<string> {
    if (!ownerUserId || ownerUserId === actor.id) return actor.id;
    if (!this.seesAll(actor)) throw new ForbiddenException('Chỉ SuperAdmin chuyển người phụ trách');
    if (!UUID.test(ownerUserId)) throw new BadRequestException('Chọn người phụ trách đang hoạt động');
    const owner = await this.prisma.user.findFirst({
      where: { id: ownerUserId, isDeleted: false, status: 'active', role: { in: [UserRole.Sales, UserRole.SuperAdmin] } },
      select: { id: true },
    });
    if (!owner) throw new BadRequestException('Chọn người phụ trách đang hoạt động');
    return owner.id;
  }

  private async requireChannel(channelId: string) {
    if (!UUID.test(channelId ?? '')) throw new BadRequestException('Chọn kênh');
    const channel = await this.prisma.crmMarketingChannel.findUnique({ where: { id: channelId } });
    if (!channel) throw new BadRequestException('Không tìm thấy kênh');
    return channel;
  }

  private async requireCampaign(actor: AuthenticatedUser, campaignId: string) {
    if (!UUID.test(campaignId)) throw new NotFoundException('Không tìm thấy chiến dịch');
    const campaign = await this.prisma.crmCampaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new NotFoundException('Không tìm thấy chiến dịch');
    if (!this.seesAll(actor) && campaign.ownerUserId !== actor.id) {
      throw new ForbiddenException('Chiến dịch này thuộc người phụ trách khác');
    }
    return campaign;
  }

  private async nextCode(): Promise<string> {
    const stamp = new Date().toISOString().slice(0, 7).replace('-', '');
    return `CD-${stamp}-${randomBytes(2).toString('hex').toUpperCase()}`;
  }

  private async ownerNames(ids: string[]): Promise<Map<string, string>> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, displayName: true },
    });
    return new Map(users.map((user) => [user.id, user.displayName]));
  }

  private seesAll(actor: AuthenticatedUser): boolean {
    return actor.role === UserRole.SuperAdmin;
  }

  private own(actor: AuthenticatedUser): { ownerUserId: string } | undefined {
    return this.seesAll(actor) ? undefined : { ownerUserId: actor.id };
  }

  private assertSpend(actor: AuthenticatedUser) {
    if (!this.seesAll(actor)) throw new ForbiddenException('Chỉ SuperAdmin ghi ngân sách và chi phí');
  }

  private group(value: string): 'owned' | 'social' {
    return value === 'social' ? 'social' : 'owned';
  }

  private async ensureStandardChannels() {
    const existing = await this.prisma.crmMarketingChannel.findMany({ select: { code: true } });
    const have = new Set(existing.map((row) => row.code));
    const missing = STANDARD_CHANNELS.filter((row) => !have.has(row.code));
    if (missing.length === 0) return;
    await this.prisma.crmMarketingChannel.createMany({ data: missing, skipDuplicates: true });
  }
}
