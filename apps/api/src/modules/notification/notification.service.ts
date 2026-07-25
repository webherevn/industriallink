import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  type DomainEventEnvelope,
  type NotificationListResponse,
  type NotificationView,
} from '@industriallink/contracts';
import { applicationStatusLabel } from '../../shared/domain/application-status.label';
import {
  buildApplicationStatusChangedEmail,
  buildApplicationSubmittedEmail,
} from '../../shared/infrastructure/email/application-email.templates';
import { EmailService } from '../../shared/infrastructure/email/email.service';
import {
  buildInterviewCancelledEmail,
  buildInterviewInviteEmail,
} from '../../shared/infrastructure/email/interview-email.templates';
import {
  buildOfferLetterEmail,
  buildOfferUpdatedEmail,
} from '../../shared/infrastructure/email/offer-email.templates';
import { buildOnboardingWelcomeEmail } from '../../shared/infrastructure/email/onboarding-email.templates';
import { buildOtpEmail } from '../../shared/infrastructure/email/otp-email.templates';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import type { AuthenticatedUser } from '../../shared/security/security.types';

function interviewTypeLabel(type: string): string {
  if (type === 'technical') return 'Phỏng vấn chuyên môn';
  if (type === 'hr') return 'Phỏng vấn HR';
  return 'Phỏng vấn';
}

/**
 * Notification Domain: in-app + email mời PV (Email Gateway).
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async listMine(
    user: AuthenticatedUser,
    take = 30,
  ): Promise<NotificationListResponse> {
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: Math.min(Math.max(take, 1), 100),
      }),
      this.prisma.notification.count({
        where: { userId: user.id, readAt: null },
      }),
    ]);

    return {
      items: items.map((n) => this.toView(n)),
      unreadCount,
    };
  }

  async markRead(user: AuthenticatedUser, id: string): Promise<NotificationView> {
    const existing = await this.prisma.notification.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy thông báo');
    }
    if (existing.readAt) {
      return this.toView(existing);
    }
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return this.toView(updated);
  }

  async markAllRead(user: AuthenticatedUser): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  /** Tạo thông báo in-app đơn giản (kết nối ứng viên, v.v.). */
  async createInApp(input: {
    tenantId: string;
    userId: string;
    type: string;
    title: string;
    body: string;
    link?: string | null;
    entityType?: string | null;
    entityId?: string | null;
  }): Promise<void> {
    await this.prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      },
    });
  }

  /** OtpIssued → gửi email OTP (đọc mã từ DB, không lấy từ payload). */
  async onOtpIssued(event: DomainEventEnvelope): Promise<void> {
    const payload = event.payload as {
      userId: string;
      email: string;
      purpose: string;
    };

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, displayName: true },
      });
      if (!user) {
        this.logger.warn(`OtpIssued: không tìm thấy user ${payload.userId}`);
        return;
      }

      const otp = await this.prisma.otpCode.findFirst({
        where: {
          userId: user.id,
          purpose: payload.purpose,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (!otp) {
        this.logger.warn(`OtpIssued: không có OTP hợp lệ cho user ${user.id}`);
        return;
      }

      const purposeLabel =
        payload.purpose === 'register'
          ? 'đăng ký tài khoản'
          : payload.purpose === 'login'
            ? 'đăng nhập (MFA)'
            : payload.purpose;

      const sent = await this.email.sendSafe(
        buildOtpEmail({
          displayName: user.displayName,
          email: user.email,
          otp: otp.code,
          purposeLabel,
          expiresMinutes: 10,
        }),
      );

      this.logger.log(
        `otp.issued purpose=${payload.purpose} → ${user.email}, email=${sent ? 'sent' : 'failed'}`,
      );
    } catch (err) {
      this.logger.error(`Lỗi xử lý OtpIssued (eventId=${event.eventId}): ${String(err)}`);
      throw err;
    }
  }

  /** ApplicationSubmitted → thông báo nhà tuyển dụng (thành viên công ty). */
  async onApplicationSubmitted(event: DomainEventEnvelope): Promise<void> {
    const payload = event.payload as {
      applicationId: string;
      jobId: string;
      candidateId: string;
    };

    try {
      const application = await this.prisma.application.findUnique({
        where: { id: payload.applicationId },
        include: {
          candidate: { select: { displayName: true } },
          job: {
            select: {
              id: true,
              title: true,
              companyId: true,
              company: {
                select: {
                  members: {
                    select: { userId: true, user: { select: { email: true } } },
                  },
                },
              },
            },
          },
        },
      });

      if (!application) {
        this.logger.warn(
          `ApplicationSubmitted: không tìm thấy application ${payload.applicationId}`,
        );
        return;
      }

      const recipients = [
        ...new Map(
          application.job.company.members.map((m) => [m.userId, m.user.email]),
        ),
      ];
      if (recipients.length === 0) {
        this.logger.warn(
          `ApplicationSubmitted: công ty không có thành viên để nhận thông báo (job=${application.job.id})`,
        );
        return;
      }

      const title = 'Có ứng viên mới ứng tuyển';
      const body = `${application.candidate.displayName} đã ứng tuyển vị trí «${application.job.title}».`;
      const link = `/jobs/${application.job.id}/applicants`;

      await this.prisma.notification.createMany({
        data: recipients.map(([userId]) => ({
          tenantId: event.tenantId,
          userId,
          type: 'application.submitted',
          title,
          body,
          link,
          entityType: 'application',
          entityId: application.id,
        })),
      });

      const applicantsUrl = `${this.email.webOrigin}${link}`;
      const { sent, failed } = await this.email.sendMany(
        recipients.map(([, recruiterEmail]) =>
          buildApplicationSubmittedEmail({
            recruiterEmail,
            candidateName: application.candidate.displayName,
            jobTitle: application.job.title,
            applicantsUrl,
          }),
        ),
      );

      this.logger.log(
        `Đã tạo ${recipients.length} thông báo application.submitted (applicationId=${application.id}), email sent=${sent} failed=${failed}`,
      );
    } catch (err) {
      this.logger.error(
        `Lỗi xử lý ApplicationSubmitted (eventId=${event.eventId}): ${String(err)}`,
      );
      throw err;
    }
  }

  /** ApplicationStatusChanged → thông báo ứng viên. */
  async onApplicationStatusChanged(event: DomainEventEnvelope): Promise<void> {
    const payload = event.payload as {
      applicationId: string;
      from: string;
      to: string;
    };

    try {
      const application = await this.prisma.application.findUnique({
        where: { id: payload.applicationId },
        include: {
          candidate: {
            select: { displayName: true, userId: true, user: { select: { email: true } } },
          },
          job: { select: { title: true } },
        },
      });

      if (!application) {
        this.logger.warn(
          `ApplicationStatusChanged: không tìm thấy application ${payload.applicationId}`,
        );
        return;
      }

      const fromLabel = applicationStatusLabel(payload.from);
      const toLabel = applicationStatusLabel(payload.to);
      const title = 'Cập nhật trạng thái hồ sơ';
      const body = `Hồ sơ của bạn cho «${application.job.title}» đã chuyển từ ${fromLabel} sang ${toLabel}.`;
      const link = `/applications`;

      await this.prisma.notification.create({
        data: {
          tenantId: event.tenantId,
          userId: application.candidate.userId,
          type: 'application.status_changed',
          title,
          body,
          link,
          entityType: 'application',
          entityId: application.id,
        },
      });

      const sent = await this.email.sendSafe(
        buildApplicationStatusChangedEmail({
          candidateName: application.candidate.displayName,
          candidateEmail: application.candidate.user.email,
          jobTitle: application.job.title,
          fromLabel,
          toLabel,
          applicationsUrl: `${this.email.webOrigin}${link}`,
        }),
      );

      this.logger.log(
        `application.status_changed → user ${application.candidate.userId} (${payload.from}→${payload.to}), email=${sent ? 'sent' : 'failed'}`,
      );
    } catch (err) {
      this.logger.error(
        `Lỗi xử lý ApplicationStatusChanged (eventId=${event.eventId}): ${String(err)}`,
      );
      throw err;
    }
  }

  /** InterviewScheduled → thông báo in-app + email mời PV. */
  async onInterviewScheduled(event: DomainEventEnvelope): Promise<void> {
    const payload = event.payload as {
      interviewId: string;
      applicationId: string;
      scheduledAt: string;
      type: string;
    };

    try {
      const interview = await this.prisma.interview.findUnique({
        where: { id: payload.interviewId },
        include: {
          candidate: {
            select: {
              displayName: true,
              user: { select: { id: true, email: true } },
            },
          },
          job: {
            select: {
              title: true,
              company: { select: { name: true } },
            },
          },
        },
      });
      if (!interview) {
        this.logger.warn(`InterviewScheduled: không tìm thấy ${payload.interviewId}`);
        return;
      }

      const when = new Date(payload.scheduledAt).toLocaleString('vi-VN');
      const typeLabel = interviewTypeLabel(payload.type);
      const applicationsUrl = `${this.email.webOrigin}/applications`;

      await this.prisma.notification.create({
        data: {
          tenantId: event.tenantId,
          userId: interview.candidate.user.id,
          type: 'interview.scheduled',
          title: 'Bạn có lịch phỏng vấn mới',
          body: `Buổi ${typeLabel} cho «${interview.job.title}» lúc ${when}.`,
          link: '/applications',
          entityType: 'interview',
          entityId: interview.id,
        },
      });

      const sent = await this.email.sendSafe(
        buildInterviewInviteEmail({
          candidateName: interview.candidate.displayName,
          candidateEmail: interview.candidate.user.email,
          jobTitle: interview.job.title,
          companyName: interview.job.company.name,
          typeLabel,
          scheduledAtLabel: when,
          durationMinutes: interview.durationMinutes,
          location: interview.location,
          meetingLink: interview.meetingLink,
          interviewerName: interview.interviewerName,
          notes: interview.notes,
          applicationsUrl,
        }),
      );

      this.logger.log(
        `interview.scheduled → user ${interview.candidate.user.id}, email=${sent ? 'sent' : 'failed'}`,
      );
    } catch (err) {
      this.logger.error(
        `Lỗi xử lý InterviewScheduled (eventId=${event.eventId}): ${String(err)}`,
      );
      throw err;
    }
  }

  /** InterviewUpdated → thông báo + email khi huỷ / đổi lịch. */
  async onInterviewUpdated(event: DomainEventEnvelope): Promise<void> {
    const payload = event.payload as {
      interviewId: string;
      applicationId: string;
      status: string;
      scheduledAt: string;
    };

    try {
      const interview = await this.prisma.interview.findUnique({
        where: { id: payload.interviewId },
        include: {
          candidate: {
            select: {
              displayName: true,
              user: { select: { id: true, email: true } },
            },
          },
          job: {
            select: {
              title: true,
              company: { select: { name: true } },
            },
          },
        },
      });
      if (!interview) return;

      const cancelled = payload.status === 'cancelled';
      const when = new Date(payload.scheduledAt).toLocaleString('vi-VN');
      const applicationsUrl = `${this.email.webOrigin}/applications`;

      await this.prisma.notification.create({
        data: {
          tenantId: event.tenantId,
          userId: interview.candidate.user.id,
          type: cancelled ? 'interview.cancelled' : 'interview.updated',
          title: cancelled ? 'Lịch phỏng vấn đã bị huỷ' : 'Lịch phỏng vấn đã thay đổi',
          body: cancelled
            ? `Buổi PV cho «${interview.job.title}» đã bị huỷ.`
            : `Lịch PV «${interview.job.title}» cập nhật: ${when}.`,
          link: '/applications',
          entityType: 'interview',
          entityId: interview.id,
        },
      });

      if (cancelled) {
        await this.email.sendSafe(
          buildInterviewCancelledEmail({
            candidateName: interview.candidate.displayName,
            candidateEmail: interview.candidate.user.email,
            jobTitle: interview.job.title,
            companyName: interview.job.company.name,
            scheduledAtLabel: when,
            applicationsUrl,
          }),
        );
      } else {
        await this.email.sendSafe(
          buildInterviewInviteEmail({
            candidateName: interview.candidate.displayName,
            candidateEmail: interview.candidate.user.email,
            jobTitle: interview.job.title,
            companyName: interview.job.company.name,
            typeLabel: interviewTypeLabel(interview.type),
            scheduledAtLabel: when,
            durationMinutes: interview.durationMinutes,
            location: interview.location,
            meetingLink: interview.meetingLink,
            interviewerName: interview.interviewerName,
            notes: interview.notes,
            applicationsUrl,
          }),
        );
      }

      this.logger.log(
        `interview.${cancelled ? 'cancelled' : 'updated'} → ${interview.candidate.user.id}`,
      );
    } catch (err) {
      this.logger.error(`Lỗi xử lý InterviewUpdated (eventId=${event.eventId}): ${String(err)}`);
      throw err;
    }
  }

  /** OfferSent → in-app + email thư offer. */
  async onOfferSent(event: DomainEventEnvelope): Promise<void> {
    const payload = event.payload as {
      offerId: string;
      applicationId: string;
      salary: number;
      currency: string;
    };

    try {
      const offer = await this.prisma.offer.findUnique({
        where: { id: payload.offerId },
        include: {
          candidate: {
            select: {
              displayName: true,
              user: { select: { id: true, email: true } },
            },
          },
          job: {
            select: {
              title: true,
              company: { select: { name: true } },
            },
          },
        },
      });
      if (!offer) {
        this.logger.warn(`OfferSent: không tìm thấy ${payload.offerId}`);
        return;
      }

      const salaryLabel = `${offer.salary.toLocaleString('vi-VN')} ${offer.currency}/tháng`;
      const applicationsUrl = `${this.email.webOrigin}/applications`;

      await this.prisma.notification.create({
        data: {
          tenantId: event.tenantId,
          userId: offer.candidate.user.id,
          type: 'offer.sent',
          title: 'Bạn nhận được đề nghị tuyển dụng',
          body: `Offer «${offer.job.title}» — ${salaryLabel}.`,
          link: '/applications',
          entityType: 'offer',
          entityId: offer.id,
        },
      });

      const sent = await this.email.sendSafe(
        buildOfferLetterEmail({
          candidateName: offer.candidate.displayName,
          candidateEmail: offer.candidate.user.email,
          jobTitle: offer.job.title,
          companyName: offer.job.company.name,
          salaryLabel,
          startDateLabel: offer.startDate
            ? offer.startDate.toISOString().slice(0, 10)
            : null,
          expiresAtLabel: offer.expiresAt
            ? offer.expiresAt.toISOString().slice(0, 10)
            : null,
          benefits: offer.benefits,
          notes: offer.notes,
          applicationsUrl,
        }),
      );

      this.logger.log(
        `offer.sent → ${offer.candidate.user.id}, email=${sent ? 'sent' : 'failed'}`,
      );
    } catch (err) {
      this.logger.error(`Lỗi xử lý OfferSent (eventId=${event.eventId}): ${String(err)}`);
      throw err;
    }
  }

  /** OnboardingStarted → in-app + email chào mừng. */
  async onOnboardingStarted(event: DomainEventEnvelope): Promise<void> {
    const payload = event.payload as {
      onboardingId: string;
      applicationId: string;
      startDate: string;
    };

    try {
      const onboarding = await this.prisma.onboarding.findUnique({
        where: { id: payload.onboardingId },
        include: {
          candidate: {
            select: {
              displayName: true,
              user: { select: { id: true, email: true } },
            },
          },
          job: {
            select: {
              title: true,
              company: { select: { name: true } },
            },
          },
        },
      });
      if (!onboarding) {
        this.logger.warn(`OnboardingStarted: không tìm thấy ${payload.onboardingId}`);
        return;
      }

      const applicationsUrl = `${this.email.webOrigin}/applications`;

      await this.prisma.notification.create({
        data: {
          tenantId: event.tenantId,
          userId: onboarding.candidate.user.id,
          type: 'onboarding.started',
          title: 'Chào mừng — bắt đầu onboarding',
          body: `Nhận việc «${onboarding.job.title}» ngày ${payload.startDate}.`,
          link: '/applications',
          entityType: 'onboarding',
          entityId: onboarding.id,
        },
      });

      const sent = await this.email.sendSafe(
        buildOnboardingWelcomeEmail({
          candidateName: onboarding.candidate.displayName,
          candidateEmail: onboarding.candidate.user.email,
          jobTitle: onboarding.job.title,
          companyName: onboarding.job.company.name,
          startDateLabel: payload.startDate,
          reportLocation: onboarding.reportLocation,
          contactName: onboarding.contactName,
          contactPhone: onboarding.contactPhone,
          checklist: onboarding.checklist,
          applicationsUrl,
        }),
      );

      this.logger.log(
        `onboarding.started → ${onboarding.candidate.user.id}, email=${sent ? 'sent' : 'failed'}`,
      );
    } catch (err) {
      this.logger.error(
        `Lỗi xử lý OnboardingStarted (eventId=${event.eventId}): ${String(err)}`,
      );
      throw err;
    }
  }

  /** OnboardingUpdated → thông báo in-app khi đổi trạng thái. */
  async onOnboardingUpdated(event: DomainEventEnvelope): Promise<void> {
    const payload = event.payload as {
      onboardingId: string;
      applicationId: string;
      status: string;
    };

    try {
      const onboarding = await this.prisma.onboarding.findUnique({
        where: { id: payload.onboardingId },
        include: {
          candidate: {
            select: {
              displayName: true,
              user: { select: { id: true } },
            },
          },
          job: { select: { title: true } },
        },
      });
      if (!onboarding) return;

      const statusLabel =
        payload.status === 'completed'
          ? 'đã hoàn tất'
          : payload.status === 'cancelled'
            ? 'đã bị huỷ'
            : payload.status === 'in_progress'
              ? 'đang diễn ra'
              : payload.status;

      await this.prisma.notification.create({
        data: {
          tenantId: event.tenantId,
          userId: onboarding.candidate.user.id,
          type: 'onboarding.updated',
          title: 'Cập nhật onboarding',
          body: `Onboarding «${onboarding.job.title}» ${statusLabel}.`,
          link: '/applications',
          entityType: 'onboarding',
          entityId: onboarding.id,
        },
      });
    } catch (err) {
      this.logger.error(
        `Lỗi xử lý OnboardingUpdated (eventId=${event.eventId}): ${String(err)}`,
      );
      throw err;
    }
  }

  /** OfferUpdated → thông báo + email khi rút / cập nhật trạng thái. */
  async onOfferUpdated(event: DomainEventEnvelope): Promise<void> {
    const payload = event.payload as {
      offerId: string;
      applicationId: string;
      status: string;
    };

    try {
      const offer = await this.prisma.offer.findUnique({
        where: { id: payload.offerId },
        include: {
          candidate: {
            select: {
              displayName: true,
              user: { select: { id: true, email: true } },
            },
          },
          job: {
            select: {
              title: true,
              company: { select: { name: true } },
            },
          },
        },
      });
      if (!offer) return;

      const statusLabel =
        payload.status === 'withdrawn'
          ? 'đã được rút lại'
          : payload.status === 'accepted'
            ? 'đã được chấp nhận'
            : payload.status === 'declined'
              ? 'đã bị từ chối'
              : payload.status;

      await this.prisma.notification.create({
        data: {
          tenantId: event.tenantId,
          userId: offer.candidate.user.id,
          type: 'offer.updated',
          title: 'Cập nhật đề nghị tuyển dụng',
          body: `Offer «${offer.job.title}» ${statusLabel}.`,
          link: '/applications',
          entityType: 'offer',
          entityId: offer.id,
        },
      });

      await this.email.sendSafe(
        buildOfferUpdatedEmail({
          candidateName: offer.candidate.displayName,
          candidateEmail: offer.candidate.user.email,
          jobTitle: offer.job.title,
          companyName: offer.job.company.name,
          statusLabel,
          applicationsUrl: `${this.email.webOrigin}/applications`,
        }),
      );
    } catch (err) {
      this.logger.error(`Lỗi xử lý OfferUpdated (eventId=${event.eventId}): ${String(err)}`);
      throw err;
    }
  }

  private toView(n: {
    id: string;
    type: string;
    title: string;
    body: string;
    link: string | null;
    entityType: string | null;
    entityId: string | null;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationView {
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      entityType: n.entityType,
      entityId: n.entityId,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    };
  }
}
