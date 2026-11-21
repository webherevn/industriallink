import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@industriallink/contracts';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import { AdminAuditService } from './admin-audit.service';

@ApiTags('Admin Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SuperAdmin)
@Controller('admin/audit')
export class AdminAuditController {
  constructor(private readonly audit: AdminAuditService) {}

  @Get()
  @ApiOperation({ summary: 'Đọc nhật ký audit (SuperAdmin)' })
  list(
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = page ? Number(page) : undefined;
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.audit.list({
      entityType: entityType || undefined,
      action: action || undefined,
      q: q || undefined,
      page: parsedPage !== undefined && Number.isFinite(parsedPage) ? parsedPage : undefined,
      limit: parsedLimit !== undefined && Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
  }
}
