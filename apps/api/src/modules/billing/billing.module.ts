import { Module } from '@nestjs/common';
import { BillingAdminController } from './billing-admin.controller';
import { BillingPublicController } from './billing-public.controller';
import { BillingRecruiterController } from './billing-recruiter.controller';
import { BillingRecruiterPaymentController } from './billing-recruiter-payment.controller';
import { BillingMockPaymentController } from './billing-mock-payment.controller';
import { BillingStripeWebhookController } from './billing-stripe-webhook.controller';
import { BillingService } from './billing.service';
import { CreditService } from './credit.service';
import { PaymentService } from './payment.service';
import { CompanyModule } from '../company/company.module';

@Module({
  imports: [CompanyModule],
  controllers: [
    BillingPublicController,
    BillingAdminController,
    BillingRecruiterController,
    BillingRecruiterPaymentController,
    BillingMockPaymentController,
    BillingStripeWebhookController,
  ],
  providers: [BillingService, CreditService, PaymentService],
  exports: [BillingService, CreditService, PaymentService],
})
export class BillingModule {}
