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
    return this.audit.list({
      entityType: entityType || undefined,
      action: action || undefined,
      q: q || undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
