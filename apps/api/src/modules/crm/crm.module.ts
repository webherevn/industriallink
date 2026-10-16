import { Module } from '@nestjs/common';
import { CrmPartnerSelfController } from './crm-partner-self.controller';
import { CrmReferralController } from './crm-referral.controller';
import { CrmController } from './crm.controller';
import { CrmService } from './crm.service';

@Module({
  controllers: [CrmController, CrmPartnerSelfController, CrmReferralController],
  providers: [CrmService],
})
export class CrmModule {}
