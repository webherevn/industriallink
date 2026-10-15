import { Module, OnModuleInit } from '@nestjs/common';
import { DomainEvents, UserRole, type DomainEventEnvelope } from '@industriallink/contracts';
import { AppEventBus } from '../../shared/events/event-bus';
import { AdminCompaniesController } from './admin-companies.controller';
import { AdminCompaniesService } from './admin-companies.service';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';

/** Company Domain: hồ sơ doanh nghiệp và thành viên (nhà tuyển dụng). */
@Module({
  controllers: [CompanyController, AdminCompaniesController],
  providers: [CompanyService, AdminCompaniesService],
  exports: [CompanyService],
})
export class CompanyModule implements OnModuleInit {
  constructor(
    private readonly events: AppEventBus,
    private readonly companies: CompanyService,
  ) {}

  onModuleInit(): void {
    this.events.subscribe(DomainEvents.UserRegistered, async (event: DomainEventEnvelope) => {
      const payload = event.payload as {
        userId?: string;
        displayName?: string;
        role?: string;
      };
      if (payload.role !== UserRole.Recruiter || !payload.userId) return;
      await this.companies.provisionForRecruiter({
        userId: payload.userId,
        displayName: payload.displayName ?? 'Nhà tuyển dụng',
        tenantId: event.tenantId,
        correlationId: event.correlationId,
      });
    });
  }
}
