import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  UserRole,
  type CreateCrmCampaignRequest,
  type CreateCrmMarketingChannelRequest,
  type CreateCrmMarketingCostRequest,
  type CrmMarketingOverview,
  type UpdateCrmCampaignRequest,
  type UpdateCrmMarketingChannelRequest,
} from '@industriallink/contracts';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { CrmMarketingService } from './crm-marketing.service';

@ApiTags('CRM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SuperAdmin, UserRole.Sales, UserRole.SalesManager)
@Controller('crm/marketing')
export class CrmMarketingController {
  constructor(private readonly marketing: CrmMarketingService) {}

  @Get()
  @ApiOperation({ summary: 'Kênh, chiến dịch và chi phí. Không tạo đơn.' })
  overview(@CurrentUser() user: AuthenticatedUser): Promise<CrmMarketingOverview> {
    return this.marketing.overview(user);
  }

  @Post('channels')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Thêm một kênh. Không nối API.' })
  createChannel(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCrmMarketingChannelRequest,
  ): Promise<CrmMarketingOverview> {
    return this.marketing.createChannel(user, body);
  }

  @Patch('channels/:id')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Bật hoặc tắt kênh. Chiến dịch cũ giữ nguyên.' })
  updateChannel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateCrmMarketingChannelRequest,
  ): Promise<CrmMarketingOverview> {
    return this.marketing.updateChannel(user, id, body);
  }

  @Post('campaigns')
  @ApiOperation({ summary: 'Tạo chiến dịch. Không tạo đơn và không bật gói.' })
  createCampaign(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCrmCampaignRequest,
  ): Promise<CrmMarketingOverview> {
    return this.marketing.createCampaign(user, body);
  }

  @Patch('campaigns/:id')
  @ApiOperation({ summary: 'Sửa chiến dịch. Ngân sách chỉ SuperAdmin đổi.' })
  updateCampaign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateCrmCampaignRequest,
  ): Promise<CrmMarketingOverview> {
    return this.marketing.updateCampaign(user, id, body);
  }

  @Post('costs')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Ghi một khoản đã chi. Không gồm hoa hồng.' })
  createCost(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateCrmMarketingCostRequest,
  ): Promise<CrmMarketingOverview> {
    return this.marketing.createCost(user, body);
  }

  @Delete('costs/:id')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Xóa khoản chi nhập nhầm. Không đụng sổ đơn.' })
  deleteCost(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<CrmMarketingOverview> {
    return this.marketing.deleteCost(user, id);
  }
}
