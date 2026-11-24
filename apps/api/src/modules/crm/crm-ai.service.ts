import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  UserRole,
  type CrmAiBriefResponse,
  type CrmAiJdDiagnosisResponse,
  type CrmAiOutreachChannel,
  type CrmAiOutreachPurpose,
  type CrmAiOutreachRequest,
  type CrmAiOutreachResponse,
} from '@industriallink/contracts';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { AiGatewayService } from '../ai/ai-gateway.service';

const PURPOSE_LABELS: Record<CrmAiOutreachPurpose, string> = {
  missing_license: 'Nhắc NTD nộp Giấy phép ĐKKD để được duyệt tin tuyển dụng công khai',
  upgrade_free: 'Tư vấn NTD nâng cấp từ gói Khám phá lên gói Tin đăng trả phí / Tin săn',
  renewal_churn: 'Chăm sóc khách hàng trả phí có nguy cơ rời bỏ hoặc sắp hết hạn gói',
  stale_quote: 'Follow-up báo giá đã gửi quá 3 ngày nhưng chưa chốt thanh toán',
  general_care: 'Chăm sóc định kỳ & hỏi thăm nhu cầu tuyển dụng sắp tới',
};

@Injectable()
export class CrmAiService {
  private readonly logger = new Logger(CrmAiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiGatewayService,
  ) {}

  private seesAll(actor: AuthenticatedUser): boolean {
    return actor.role === UserRole.SuperAdmin || actor.role === UserRole.SalesManager;
  }

  private async loadCompanyContext(actor: AuthenticatedUser, companyId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(companyId)) {
      throw new NotFoundException('Không tìm thấy công ty');
    }
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, isDeleted: false },
      select: {
        id: true,
        name: true,
        taxCode: true,
        industry: true,
        address: true,
        profile: true,
        createdAt: true,
      },
    });
    if (!company) throw new NotFoundException('Không tìm thấy công ty');

    const leads = await this.prisma.crmLead.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        leadCode: true,
        contactName: true,
        contactPhone: true,
        contactEmail: true,
        ownerUserId: true,
        status: true,
        nextFollowUpAt: true,
      },
    });

    if (!this.seesAll(actor)) {
      const owns = leads.some((l) => l.ownerUserId === actor.id);
      if (!owns && leads.length > 0) {
        throw new ForbiddenException('Bạn chỉ dùng trợ lý AI cho doanh nghiệp mình phụ trách');
      }
    }

    const leadIds = leads.map((l) => l.id);
    const [jobPkgs, huntPkgs, jobs, creditWallet, activities, paidOrders] = await Promise.all([
      this.prisma.billingJobPackage.findMany({
        where: { companyId, status: { in: ['ACTIVE', 'UNUSED'] } },
        select: { packageType: true, packageName: true, status: true, usedJobs: true, totalJobs: true, expiresAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.billingHuntPackage.findMany({
        where: { companyId, status: { in: ['ACTIVE', 'UNUSED'] } },
        select: { packageType: true, packageName: true, status: true, expiresAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.job.findMany({
        where: { companyId, isDeleted: false },
        select: {
          id: true,
          title: true,
          status: true,
          location: true,
          salaryMin: true,
          salaryMax: true,
          experienceBand: true,
          description: true,
          requirements: true,
          benefits: true,
          publishedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.billingCreditAccount.findUnique({
        where: { companyId },
        select: { balance: true },
      }),
      leadIds.length > 0
        ? this.prisma.crmActivity.findMany({
            where: { leadId: { in: leadIds } },
            orderBy: { createdAt: 'desc' },
            take: 6,
            select: { activityType: true, summary: true, createdAt: true },
          })
        : Promise.resolve([]),
      this.prisma.billingOrder.findMany({
        where: { companyId, status: 'paid', priceVndSnapshot: { gt: 0n } },
        select: { planName: true, priceVndSnapshot: true, paidAt: true },
        orderBy: { paidAt: 'desc' },
        take: 5,
      }),
    ]);

    const jobIds = jobs.map((j) => j.id);
    const appCounts =
      jobIds.length > 0
        ? await this.prisma.application.groupBy({
            by: ['jobId'],
            where: { jobId: { in: jobIds } },
            _count: { id: true },
          })
        : [];
    const appsByJob = new Map(appCounts.map((a) => [a.jobId, a._count.id]));

    const prof = (company.profile && typeof company.profile === 'object' ? company.profile : {}) as {
      verified?: boolean;
      licenseDoc?: { storageKey?: string } | null;
    };
    const hasLicense = Boolean(prof.verified || prof.licenseDoc?.storageKey);

    return {
      company,
      lead: leads[0] ?? null,
      hasLicense,
      isVerified: Boolean(prof.verified),
      jobPkgs,
      huntPkgs,
      jobs: jobs.map((j) => ({ ...j, applicantCount: appsByJob.get(j.id) ?? 0 })),
      creditBalance: creditWallet?.balance ?? 0,
      activities,
      paidOrders,
    };
  }

  private buildSummaryFacts(ctx: Awaited<ReturnType<CrmAiService['loadCompanyContext']>>): string {
    const published = ctx.jobs.filter((j) => j.status === 'published');
    const totalApps = published.reduce((s, j) => s + j.applicantCount, 0);
    const plans = [
      ...ctx.jobPkgs.map(
        (p) =>
          `${p.packageName} (${p.status}${p.expiresAt ? `, hết hạn ${p.expiresAt.toISOString().slice(0, 10)}` : ''})`,
      ),
      ...ctx.huntPkgs.map(
        (p) =>
          `${p.packageName} (${p.status}${p.expiresAt ? `, hết hạn ${p.expiresAt.toISOString().slice(0, 10)}` : ''})`,
      ),
    ];
    const recentNotes = ctx.activities
      .slice(0, 5)
      .map((a) => `- [${a.createdAt.toISOString().slice(0, 10)}] ${a.summary}`)
      .join('\n');

    return [
      `Doanh nghiệp: ${ctx.company.name}`,
      `MST: ${ctx.company.taxCode ?? 'Chưa có'} | Ngành: ${ctx.company.industry ?? 'Công nghiệp'} | Địa chỉ: ${ctx.company.address ?? 'Chưa có'}`,
      `Người liên hệ: ${ctx.lead?.contactName ?? 'HR / Bộ phận tuyển dụng'} | SĐT: ${ctx.lead?.contactPhone ?? 'Chưa có'}`,
      `Giấy phép ĐKKD: ${ctx.isVerified ? 'Đã xác thực' : ctx.hasLicense ? 'Đã nộp, chờ duyệt' : 'CHƯA NỘP ĐKKD (chưa đăng tin công khai được)'}`,
      `Gói đang có: ${plans.length > 0 ? plans.join('; ') : 'Chưa có gói hoạt động'}`,
      `Số dư Credit: ${ctx.creditBalance} | Tổng đơn đã trả: ${ctx.paidOrders.length}`,
      `Tin tuyển dụng: ${published.length} tin đang hiển thị, tổng ${totalApps} ứng viên ứng tuyển (tổng ${ctx.jobs.length} tin mọi trạng thái).`,
      recentNotes ? `Nhật ký chăm sóc gần nhất:\n${recentNotes}` : 'Nhật ký chăm sóc: Chưa có ghi chú.',
    ].join('\n');
  }

  /** 1. AI Tóm tắt hồ sơ 30 giây & Gợi ý mở lời trước khi gọi */
  async companyBrief(actor: AuthenticatedUser, companyId: string): Promise<CrmAiBriefResponse> {
    const ctx = await this.loadCompanyContext(actor, companyId);
    const facts = this.buildSummaryFacts(ctx);

    const system = [
      'Bạn là Trợ lý Sale & CS B2B của nền tảng tuyển dụng công nghiệp inLink.vn.',
      'Hãy đọc dữ liệu khách hàng và trả về bản tóm tắt 30 giây siêu ngắn gọn bằng tiếng Việt theo đúng 3 mục:',
      '1. Tình trạng hiện tại (1-2 câu ngắn)',
      '2. Cơ hội / Rủi ro lớn nhất cần xử lý ngay (1-2 gạch đầu dòng)',
      '3. Gợi ý câu mở lời & hướng tư vấn gói (1 câu mở lời tự nhiên cho Sale gọi điện/Zalo + gợi ý gói phù hợp: Tin đăng / Tin săn / Top-up Credit)',
      'Không bịa số liệu ngoài dữ liệu đã cung cấp. Trình bày sạch, dễ đọc nhanh trên màn hình.',
    ].join('\n');

    let content = '';
    try {
      const reply = await this.ai.chat({ system, user: facts });
      if (reply && reply.trim().length > 30 && !reply.includes('[Mock AI')) {
        content = reply.trim();
      }
    } catch (err) {
      this.logger.warn(`AI companyBrief fallback: ${String(err)}`);
    }

    if (!content) {
      const published = ctx.jobs.filter((j) => j.status === 'published');
      const totalApps = published.reduce((s, j) => s + j.applicantCount, 0);
      const issues: string[] = [];
      if (!ctx.hasLicense) issues.push('Chưa nộp Giấy phép ĐKKD nên chưa thể hiển thị tin tuyển dụng công khai.');
      if (ctx.jobPkgs.length === 0 && ctx.huntPkgs.length === 0) issues.push('Chưa có gói dịch vụ đang hoạt động.');
      if (ctx.creditBalance <= 2) issues.push(`Ví Credit còn thấp (${ctx.creditBalance} Credit), phù hợp tư vấn nạp thêm Credit.`);
      if (published.length > 0 && totalApps === 0) issues.push('Đang có tin hiển thị nhưng chưa phát sinh ứng viên — nên rà soát lại JD.');
      if (issues.length === 0) issues.push('Tài khoản đang vận hành ổn định, phù hợp hỏi thăm nhu cầu mở rộng vị trí mới.');

      content = [
        `1. Tình trạng hiện tại:\n- ${ctx.company.name} đang có ${published.length} tin hiển thị (${totalApps} ứng viên), số dư ${ctx.creditBalance} Credit, ${ctx.paidOrders.length} đơn đã thanh toán.`,
        `2. Cơ hội / Rủi ro cần xử lý ngay:\n${issues.map((i) => `- ${i}`).join('\n')}`,
        `3. Gợi ý câu mở lời:\n- "Chào anh/chị ${ctx.lead?.contactName ?? ''}, em bên bộ phận hỗ trợ doanh nghiệp inLink.vn gọi kiểm tra tình hình tuyển dụng bên mình${!ctx.hasLicense ? ' và hỗ trợ anh/chị tải nhanh Giấy phép ĐKKD để tin tuyển dụng lên sóng sớm nhất' : ' xem có cần bên em tối ưu thêm tin đăng hoặc mở rộng nguồn ứng viên kỹ thuật không ạ'}."`,
      ].join('\n\n');
    }

    return {
      provider: this.ai.providerName,
      generatedAt: new Date().toISOString(),
      content,
    };
  }

  /** 2. AI Soạn tin nhắn Zalo / Email 1 chạm theo đúng ngữ cảnh */
  async draftOutreach(
    actor: AuthenticatedUser,
    companyId: string,
    input: CrmAiOutreachRequest,
  ): Promise<CrmAiOutreachResponse> {
    const channel: CrmAiOutreachChannel = input.channel === 'email' ? 'email' : 'zalo';
    const purpose: CrmAiOutreachPurpose = PURPOSE_LABELS[input.purpose] ? input.purpose : 'general_care';
    const ctx = await this.loadCompanyContext(actor, companyId);
    const facts = this.buildSummaryFacts(ctx);

    const system = [
      'Bạn là chuyên viên tư vấn khách hàng B2B của nền tảng tuyển dụng ngành công nghiệp inLink.vn.',
      channel === 'zalo'
        ? 'Hãy soạn 1 tin nhắn ZALO ngắn gọn (tối đa 5-6 câu), tự nhiên, lịch sự, dễ đọc trên điện thoại, không quá dài dòng.'
        : 'Hãy soạn 1 EMAIL B2B chuyên nghiệp, ngắn gọn, có dòng đầu tiên là "Tiêu đề: ..." và các dòng sau là nội dung email.',
      'Dựa chính xác vào dữ liệu doanh nghiệp được cung cấp, xưng "em" và gọi khách là "anh/chị", kết thúc bằng 1 lời kêu gọi hành động nhẹ nhàng.',
    ].join('\n');

    const user = [
      `Mục đích liên hệ: ${PURPOSE_LABELS[purpose]}`,
      input.customNote?.trim() ? `Ghi chú thêm của Sale: ${input.customNote.trim()}` : '',
      '--- Dữ liệu doanh nghiệp ---',
      facts,
    ]
      .filter(Boolean)
      .join('\n');

    let raw = '';
    try {
      const reply = await this.ai.chat({ system, user });
      if (reply && reply.trim().length > 20 && !reply.includes('[Mock AI')) {
        raw = reply.trim();
      }
    } catch (err) {
      this.logger.warn(`AI draftOutreach fallback: ${String(err)}`);
    }

    let subject: string | null = null;
    let message = raw;

    if (!message) {
      const contact = ctx.lead?.contactName ? `anh/chị ${ctx.lead.contactName}` : 'anh/chị';
      const fallbackMap: Record<CrmAiOutreachPurpose, { subject: string; body: string }> = {
        missing_license: {
          subject: `[inLink.vn] Hỗ trợ xác thực Giấy phép ĐKKD cho ${ctx.company.name}`,
          body: `Chào ${contact}, em bên đội ngũ hỗ trợ doanh nghiệp inLink.vn ạ. Em thấy tài khoản ${ctx.company.name} đã tạo thành công nhưng chưa tải lên Giấy phép ĐKKD nên tin tuyển dụng chưa hiển thị công khai được. Anh/chị chỉ cần gửi ảnh/PDF ĐKKD (hoặc tải tại mục Hồ sơ công ty), bên em sẽ duyệt nhanh trong 15 phút để mình lên tin tuyển dụng ngay nhé!`,
        },
        upgrade_free: {
          subject: `[inLink.vn] Gói Khám phá của ${ctx.company.name} sắp hết hạn — Ưu đãi nâng cấp`,
          body: `Chào ${contact}, em bên inLink.vn nhắn báo gói Khám phá của ${ctx.company.name} sắp hết hiệu lực. Để tin tuyển dụng không bị gián đoạn và tiếp cận trực tiếp ứng viên kỹ thuật/sản xuất, em xin gửi bảng quyền lợi gói Tin đăng & Tin săn phù hợp nhất cho bên mình tham khảo nhé. Anh/chị tiện trao đổi nhanh 3 phút trong hôm nay không ạ?`,
        },
        renewal_churn: {
          subject: `[inLink.vn] Kiểm tra hiệu quả tuyển dụng & hỗ trợ gói dịch vụ cho ${ctx.company.name}`,
          body: `Chào ${contact}, em bên bộ phận chăm sóc khách hàng inLink.vn ạ. Em vừa rà soát tài khoản ${ctx.company.name} để đảm bảo quyền lợi gói dịch vụ bên mình được khai thác tối đa. Nếu bên mình đang cần hỗ trợ tối ưu lại JD, đẩy tin hoặc kích hoạt chiến dịch tìm ứng viên, anh/chị nhắn em để em hỗ trợ trực tiếp ngay nhé!`,
        },
        stale_quote: {
          subject: `[inLink.vn] Nhắc lịch trao đổi báo giá dịch vụ tuyển dụng cho ${ctx.company.name}`,
          body: `Chào ${contact}, em gửi lại lời chào từ inLink.vn ạ. Hôm trước em có gửi báo giá gói tuyển dụng cho ${ctx.company.name}, không biết bên mình đã xem qua và có cần em điều chỉnh thêm phương án gói hoặc hỗ trợ thủ tục hóa đơn/hợp đồng không ạ?`,
        },
        general_care: {
          subject: `[inLink.vn] Thăm hỏi kế hoạch tuyển dụng của ${ctx.company.name}`,
          body: `Chào ${contact}, em bên inLink.vn hỏi thăm tình hình tuyển dụng tuần này của ${ctx.company.name} ạ. Thời gian tới bên mình có kế hoạch mở thêm vị trí kỹ thuật hay khối kinh doanh công nghiệp nào không, để em hỗ trợ rà nguồn ứng viên phù hợp sẵn cho mình nhé!`,
        },
      };
      const fb = fallbackMap[purpose];
      subject = channel === 'email' ? fb.subject : null;
      message = fb.body;
    } else if (channel === 'email') {
      const lines = raw.split(/\r?\n/);
      const firstLine = lines[0]?.trim() ?? '';
      if (/^(tiêu đề|subject)\s*:/i.test(firstLine)) {
        subject = firstLine.replace(/^(tiêu đề|subject)\s*:\s*/i, '').trim();
        message = lines.slice(1).join('\n').trim();
      } else {
        subject = `[inLink.vn] Hỗ trợ tuyển dụng dành cho ${ctx.company.name}`;
      }
    }

    return {
      provider: this.ai.providerName,
      channel,
      purpose,
      subject,
      message,
    };
  }

  /** 3. AI Chẩn đoán & Tối ưu JD cho khách hàng (đặc biệt khi tin chạy >7 ngày nhưng 0 ứng viên) */
  async diagnoseCompanyJds(
    actor: AuthenticatedUser,
    companyId: string,
  ): Promise<CrmAiJdDiagnosisResponse> {
    const ctx = await this.loadCompanyContext(actor, companyId);
    const targetJobs = ctx.jobs
      .filter((j) => j.status === 'published' || j.status === 'paused' || j.status === 'draft')
      .slice(0, 3);

    if (targetJobs.length === 0) {
      return {
        provider: this.ai.providerName,
        analyzedJobCount: 0,
        jobTitles: [],
        diagnosis:
          'Doanh nghiệp hiện chưa có tin tuyển dụng nào trên hệ thống. CS nên liên hệ hỗ trợ HR đăng tin đầu tiên (có thể gửi JD Word/PDF để đội ngũ hỗ trợ lên tin nhanh).',
      };
    }

    const jdDump = targetJobs
      .map((j, i) => {
        const salary =
          j.salaryMin || j.salaryMax
            ? `${j.salaryMin ?? '?'} - ${j.salaryMax ?? '?'} triệu`
            : 'Thỏa thuận (chưa công khai mức lương)';
        return [
          `--- TIN #${i + 1}: ${j.title} ---`,
          `Trạng thái: ${j.status} | Ứng viên đã nộp: ${j.applicantCount} | Khu vực: ${j.location ?? 'Chưa ghi'} | Mức lương: ${salary}`,
          `Mô tả (trích): ${(j.description || '').slice(0, 600)}`,
          `Yêu cầu (trích): ${(j.requirements || 'Chưa ghi rõ').slice(0, 400)}`,
          `Quyền lợi (trích): ${(j.benefits || 'Chưa ghi rõ').slice(0, 300)}`,
        ].join('\n');
      })
      .join('\n\n');

    const system = [
      'Bạn là chuyên gia tối ưu tin tuyển dụng ngành công nghiệp & sản xuất của inLink.vn.',
      'Hãy phân tích nhanh các tin tuyển dụng của doanh nghiệp này để CS gửi gợi ý cải thiện giúp tăng lượng ứng viên ứng tuyển:',
      '1. Điểm yếu khiến ứng viên ít bấm ứng tuyển (chỉ rõ từng điểm cụ thể: tiêu đề, mức lương, mô tả, quyền lợi, địa điểm).',
      '2. Gợi ý chỉnh sửa cụ thể (đề xuất tiêu đề mới dễ tìm hơn + 3 điểm cần bổ sung vào JD).',
      '3. Một đoạn tin nhắn ngắn (3-4 câu) để CS gửi thẳng cho HR nhà máy đề xuất sửa JD.',
      'Viết tiếng Việt súc tích, thực tế, dễ áp dụng ngay.',
    ].join('\n');

    let diagnosis = '';
    try {
      const reply = await this.ai.chat({ system, user: jdDump });
      if (reply && reply.trim().length > 30 && !reply.includes('[Mock AI')) {
        diagnosis = reply.trim();
      }
    } catch (err) {
      this.logger.warn(`AI diagnoseCompanyJds fallback: ${String(err)}`);
    }

    if (!diagnosis) {
      const tips: string[] = [];
      for (const j of targetJobs) {
        const missing: string[] = [];
        if (!j.salaryMin && !j.salaryMax) missing.push('chưa công khai khoảng lương (ứng viên công nghiệp thường bỏ qua tin ghi "Thỏa thuận")');
        if (!j.benefits || j.benefits.trim().length < 30) missing.push('phần quyền lợi (phụ cấp ăn trưa, xe đưa đón, thưởng, BHXH) còn sơ sài');
        if (!j.requirements || j.requirements.trim().length < 30) missing.push('yêu cầu kinh nghiệm/kỹ năng chưa rõ ràng');
        if ((j.description || '').trim().length < 100) missing.push('mô tả công việc quá ngắn');
        tips.push(
          `• "${j.title}" (${j.applicantCount} UV): ${missing.length > 0 ? missing.join('; ') : 'Nội dung tương đối đầy đủ — nên làm mới tiêu đề gắn thêm địa điểm KCN/tỉnh và mức thu nhập cụ thể.'}`,
        );
      }
      diagnosis = [
        '1. Điểm cần tối ưu trên các tin hiện tại:',
        tips.join('\n'),
        '\n2. Gợi ý gửi HR khách hàng:',
        `"Chào anh/chị, em bên bộ phận hỗ trợ inLink.vn vừa rà soát tin tuyển dụng bên mình. Để tăng gấp đôi lượng hồ sơ ứng tuyển, anh/chị nên bổ sung khoảng thu nhập cụ thể và các phụ cấp thực tế (ăn ca, chuyên cần, xe đưa đón nếu có) ngay đầu tin. Nếu anh/chị đồng ý, em gửi bản gợi ý tối ưu để mình cập nhật luôn nhé!"`,
      ].join('\n');
    }

    return {
      provider: this.ai.providerName,
      analyzedJobCount: targetJobs.length,
      jobTitles: targetJobs.map((j) => j.title),
      diagnosis,
    };
  }
}
