import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@industriallink/contracts';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { Roles } from '../../../shared/security/roles.decorator';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { AdminReportsService } from './admin-reports.service';

@ApiTags('Admin Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SuperAdmin)
@Controller('admin/reports')
export class AdminReportsController {
  constructor(private readonly reports: AdminReportsService) {}

  @Get()
  @ApiOperation({ summary: 'KPI vận hành SuperAdmin' })
  overview() {
    return this.reports.overview();
  }
}
