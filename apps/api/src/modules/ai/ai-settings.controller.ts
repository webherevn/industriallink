import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  UserRole,
  type AiSettingsView,
  type TestAiConnectionResponse,
} from '@industriallink/contracts';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { AiGatewayService } from './ai-gateway.service';
import { AiSettingsService } from './ai-settings.service';
import { TestAiConnectionDto } from './dto/test-ai-connection.dto';
import { UpdateAiSettingsDto } from './dto/update-ai-settings.dto';

@ApiTags('Admin AI Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SuperAdmin)
@Controller('admin/ai-settings')
export class AiSettingsController {
  constructor(
    private readonly settings: AiSettingsService,
    private readonly gateway: AiGatewayService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Cấu hình AI hiện tại (key đã che)' })
  get(): Promise<AiSettingsView> {
    return this.settings.getView();
  }

  @Put()
  @ApiOperation({ summary: 'Cập nhật provider/model/API key + nạp lại AI Gateway' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAiSettingsDto,
  ): Promise<AiSettingsView> {
    const view = await this.settings.update(dto, user.id);
    // Áp dụng ngay, không cần restart.
    await this.gateway.reload();
    return view;
  }

  @Post('test')
  @ApiOperation({ summary: 'Test kết nối tới provider (mặc định: đang lưu)' })
  test(@Body() dto: TestAiConnectionDto): Promise<TestAiConnectionResponse> {
    return this.settings.testConnection(dto.provider);
  }
}
