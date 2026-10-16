import { Module } from '@nestjs/common';
import { CrmModule } from '../crm/crm.module';
import { AdminAuditController } from './admin-audit.controller';
import { AdminAuditService } from './admin-audit.service';
import { AuthController } from './auth.controller';
import { AuthCleanupService } from './cleanup.service';
import { IdentityService } from './identity.service';

@Module({
  imports: [CrmModule],
  controllers: [AuthController, AdminAuditController],
  providers: [IdentityService, AuthCleanupService, AdminAuditService],
  exports: [IdentityService],
})
export class IdentityModule {}
