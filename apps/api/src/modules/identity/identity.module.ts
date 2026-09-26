import { Module } from '@nestjs/common';
import { AdminAuditController } from './admin-audit.controller';
import { AdminAuditService } from './admin-audit.service';
import { AuthController } from './auth.controller';
import { AuthCleanupService } from './cleanup.service';
import { IdentityService } from './identity.service';

@Module({
  controllers: [AuthController, AdminAuditController],
  providers: [IdentityService, AuthCleanupService, AdminAuditService],
  exports: [IdentityService],
})
export class IdentityModule {}
