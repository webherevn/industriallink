import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@industriallink/contracts';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import { AnalyticsService } from './analytics.service';

@ApiTags('Admin Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SuperAdmin)
@Controller('admin/analytics')
export class AnalyticsAdminController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Tổng quan lượt truy cập' })
  overview(@Query('range') range?: string) {
    return this.analytics.overview(range);
  }

  @Get('realtime')
  @ApiOperation({ summary: 'Người đang truy cập (5 phút)' })
  realtime() {
    return this.analytics.realtime();
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Danh sách phiên (không kèm IP)' })
  sessions(@Query('page') page?: string, @Query('q') q?: string) {
    return this.analytics.sessions(page, q);
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: 'Chi tiết phiên, gồm IP' })
  session(@Param('sessionId') sessionId: string) {
    return this.analytics.sessionDetail(sessionId);
  }
}
