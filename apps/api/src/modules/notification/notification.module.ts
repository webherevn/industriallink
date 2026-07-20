import { Module, OnModuleInit } from '@nestjs/common';
import { DomainEvents, type DomainEventEnvelope } from '@industriallink/contracts';
import { AppEventBus } from '../../shared/events/event-bus';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

/**
 * Notification Domain. Lắng nghe sự kiện tuyển dụng để tạo thông báo in-app.
 * Không phụ thuộc trực tiếp Recruitment — chỉ subscribe Event Bus.
 */
@Module({
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule implements OnModuleInit {
  constructor(
    private readonly events: AppEventBus,
    private readonly notifications: NotificationService,
  ) {}

  onModuleInit(): void {
    this.events.subscribe(DomainEvents.OtpIssued, (event: DomainEventEnvelope) =>
      this.notifications.onOtpIssued(event),
    );
    this.events.subscribe(DomainEvents.ApplicationSubmitted, (event: DomainEventEnvelope) =>
      this.notifications.onApplicationSubmitted(event),
    );
    this.events.subscribe(DomainEvents.ApplicationStatusChanged, (event: DomainEventEnvelope) =>
      this.notifications.onApplicationStatusChanged(event),
    );
    this.events.subscribe(DomainEvents.InterviewScheduled, (event: DomainEventEnvelope) =>
      this.notifications.onInterviewScheduled(event),
    );
    this.events.subscribe(DomainEvents.InterviewUpdated, (event: DomainEventEnvelope) =>
      this.notifications.onInterviewUpdated(event),
    );
    this.events.subscribe(DomainEvents.OfferSent, (event: DomainEventEnvelope) =>
      this.notifications.onOfferSent(event),
    );
    this.events.subscribe(DomainEvents.OfferUpdated, (event: DomainEventEnvelope) =>
      this.notifications.onOfferUpdated(event),
    );
    this.events.subscribe(DomainEvents.OnboardingStarted, (event: DomainEventEnvelope) =>
      this.notifications.onOnboardingStarted(event),
    );
    this.events.subscribe(DomainEvents.OnboardingUpdated, (event: DomainEventEnvelope) =>
      this.notifications.onOnboardingUpdated(event),
    );
  }
}
