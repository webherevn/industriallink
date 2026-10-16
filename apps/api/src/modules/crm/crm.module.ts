import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { CrmPartnerSelfController } from './crm-partner-self.controller';
import { CrmReferralController } from './crm-referral.controller';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';

@Module({
  imports: [NotificationModule],
  controllers: [CrmController, CrmPartnerSelfController, CrmReferralController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
