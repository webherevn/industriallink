import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { CmsAdminController } from './cms-admin.controller';
import { AdminCmsMediaController } from './admin-cms-media.controller';
import { CmsMediaController } from './cms-media.controller';
import { CmsPublicController } from './cms-public.controller';
import { CmsService } from './cms.service';

@Module({
  controllers: [
    CmsAdminController,
    CmsPublicController,
    AdminUsersController,
    CmsMediaController,
    AdminCmsMediaController,
  ],
  providers: [CmsService, AdminUsersService],
  exports: [CmsService, AdminUsersService],
})
export class CmsModule {}
