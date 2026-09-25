import { Module } from '@nestjs/common';
import { CmsAdminController } from './cms-admin.controller';
import { CmsPublicController } from './cms-public.controller';
import { CmsService } from './cms.service';

@Module({
  controllers: [CmsAdminController, CmsPublicController],
  providers: [CmsService],
  exports: [CmsService],
})
export class CmsModule {}
