import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthCleanupService } from './cleanup.service';
import { IdentityService } from './identity.service';

@Module({
  controllers: [AuthController],
  providers: [IdentityService, AuthCleanupService],
  exports: [IdentityService],
})
export class IdentityModule {}
