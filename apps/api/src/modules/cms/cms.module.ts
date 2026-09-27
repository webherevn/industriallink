import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { CmsAdminController } from './cms-admin.controller';
import { AdminCmsMediaController } from './admin-cms-media.controller';
import { CmsMediaController } from './cms-media.controller';
import { CmsPublicController } from './cms-public.controller';
import { CmsService } from './cms.service';
import { SeoCrawlService } from './seo-crawl.service';
import { SeoLinksService } from './seo-links.service';
import { SeoSemanticService } from './seo-semantic.service';
import { SeoTrustService } from './seo-trust.service';
import { SeoVitalsService } from './seo-vitals.service';

@Module({
  imports: [AiModule],
  controllers: [
    CmsAdminController,
    CmsPublicController,
    AdminUsersController,
    CmsMediaController,
    AdminCmsMediaController,
  ],
  providers: [
    CmsService,
    SeoCrawlService,
    SeoTrustService,
    SeoLinksService,
    SeoSemanticService,
    SeoVitalsService,
    AdminUsersService,
  ],
  exports: [CmsService, AdminUsersService],
})
export class CmsModule {}
