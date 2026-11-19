import { Module, OnModuleInit } from '@nestjs/common';
import { DomainEvents, type DomainEventEnvelope } from '@industriallink/contracts';
import { AppEventBus } from '../../shared/events/event-bus';
import { BillingAdminController } from './billing-admin.controller';
import { BillingPublicController } from './billing-public.controller';
import { BillingRecruiterController } from './billing-recruiter.controller';
import { BillingRecruiterPaymentController } from './billing-recruiter-payment.controller';
import { BillingMockPaymentController } from './billing-mock-payment.controller';
import { BillingStripeWebhookController } from './billing-stripe-webhook.controller';
import { BillingService } from './billing.service';
import { CreditLotExpiryService } from './credit-lot-expiry.service';
import { CreditService } from './credit.service';
import { HuntPackageService } from './hunt-package.service';
import { JobPackageService } from './job-package.service';
import { PaymentService } from './payment.service';
import { SourcingService } from './sourcing.service';
import { CrmModule } from '../crm/crm.module';
import { CompanyModule } from '../company/company.module';

@Module({
  imports: [CompanyModule, CrmModule],
  controllers: [
    BillingPublicController,
    BillingAdminController,
    BillingRecruiterController,
    BillingRecruiterPaymentController,
    BillingMockPaymentController,
    BillingStripeWebhookController,
  ],
  providers: [
    SourcingService,
    HuntPackageService,
    JobPackageService,
    BillingService,
    CreditService,
    CreditLotExpiryService,
    PaymentService,
  ],
  exports: [
    BillingService,
    CreditService,
    PaymentService,
    SourcingService,
    HuntPackageService,
    JobPackageService,
  ],
})
export class BillingModule implements OnModuleInit {
  constructor(
    private readonly events: AppEventBus,
    private readonly billing: BillingService,
  ) {}

  onModuleInit(): void {
    this.events.subscribe(DomainEvents.CompanyCreated, async (event: DomainEventEnvelope) => {
      const payload = event.payload as { companyId?: string };
      if (!payload.companyId) return;
      await this.billing.provisionStarterPlan(payload.companyId);
    });
  }
}
