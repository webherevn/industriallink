import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';

@Module({
  imports: [BillingModule],
  controllers: [CrmController],
  providers: [CrmService],
})
export class CrmModule {}
