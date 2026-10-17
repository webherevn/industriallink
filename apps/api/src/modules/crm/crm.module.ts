import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { CrmEnterpriseController } from './crm-enterprise.controller';
import { CrmPartnerSelfController } from './crm-partner-self.controller';
import { CrmReferralController } from './crm-referral.controller';
import { CrmController } from './crm.controller';
import { CrmMarketingController } from './crm-marketing.controller';
import { CommissionCloseService } from './commission-close.service';
import { CrmMarketingService } from './crm-marketing.service';
import { CrmService } from './crm.service';

@Module({
  imports: [NotificationModule],
  controllers: [CrmController, CrmMarketingController, CrmPartnerSelfController, CrmReferralController, CrmEnterpriseController],
  providers: [CrmService, CrmMarketingService, CommissionCloseService],
  exports: [CrmService],
})
export class CrmModule {}
