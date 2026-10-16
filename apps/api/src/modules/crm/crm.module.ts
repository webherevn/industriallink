import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { CrmEnterpriseController } from './crm-enterprise.controller';
import { CrmPartnerSelfController } from './crm-partner-self.controller';
import { CrmReferralController } from './crm-referral.controller';
import { CrmController } from './crm.controller';
import { CommissionCloseService } from './commission-close.service';
import { CrmService } from './crm.service';

@Module({
  imports: [NotificationModule],
  controllers: [CrmController, CrmPartnerSelfController, CrmReferralController, CrmEnterpriseController],
  providers: [CrmService, CommissionCloseService],
  exports: [CrmService],
})
export class CrmModule {}
