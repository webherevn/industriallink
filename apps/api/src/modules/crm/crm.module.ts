import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CmsModule } from '../cms/cms.module';
import { NotificationModule } from '../notification/notification.module';
import { CrmAiController } from './crm-ai.controller';
import { CrmAiService } from './crm-ai.service';
import { CrmEnterpriseController } from './crm-enterprise.controller';
import { CrmPartnerSelfController } from './crm-partner-self.controller';
import { CrmReferralController } from './crm-referral.controller';
import { CrmController } from './crm.controller';
import { CrmCommissionPolicyController } from './crm-commission-policy.controller';
import { CrmKycAdminController, CtvKycSelfController } from './ctv-kyc.controller';
import { CtvKycService } from './ctv-kyc.service';
import { CrmSupportChatController, SupportChatController } from './support-chat.controller';
import { SupportChatService } from './support-chat.service';
import { CrmMarketingController } from './crm-marketing.controller';
import { CommissionCloseService } from './commission-close.service';
import { CrmMarketingService } from './crm-marketing.service';
import { CrmService } from './crm.service';
import { CtvCommissionPolicyService } from './ctv-commission-policy.service';

@Module({
  imports: [NotificationModule, CmsModule, AiModule],
  controllers: [
    CrmController,
    CrmAiController,
    CrmCommissionPolicyController,
    CrmMarketingController,
    CrmPartnerSelfController,
    CrmReferralController,
    CrmEnterpriseController,
    SupportChatController,
    CrmSupportChatController,
    CtvKycSelfController,
    CrmKycAdminController,
  ],
  providers: [
    CrmService,
    CrmAiService,
    CrmMarketingService,
    CommissionCloseService,
    SupportChatService,
    CtvKycService,
    CtvCommissionPolicyService,
  ],
  exports: [CrmService, CtvKycService, CtvCommissionPolicyService],
})
export class CrmModule {}
