import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@industriallink/contracts';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { SendSupportMessageDto } from './dto/send-support-message.dto';
import { SupportChatService } from './support-chat.service';

@ApiTags('Support chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('support-chat')
export class SupportChatController {
  constructor(private readonly chats: SupportChatService) {}

  @Get()
  @ApiOperation({ summary: 'Hội thoại góp ý của tôi' })
  mine(@CurrentUser() user: AuthenticatedUser, @Query('mark') mark?: string) {
    return this.chats.mine(user, mark === '1');
  }

  @Post()
  @ApiOperation({ summary: 'Gửi câu hỏi hoặc góp ý về CRM' })
  send(@CurrentUser() user: AuthenticatedUser, @Body() body: SendSupportMessageDto) {
    return this.chats.sendAsUser(user, body.body);
  }
}

@ApiTags('CRM')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SuperAdmin, UserRole.Sales, UserRole.SalesManager)
@Controller('crm/support-chats')
export class CrmSupportChatController {
  constructor(private readonly chats: SupportChatService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách chat góp ý' })
  threads() {
    return this.chats.threads();
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Tin trong một chat góp ý' })
  messages(@Param('id') id: string) {
    return this.chats.threadMessages(id);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Sale hoặc SuperAdmin trả lời chat góp ý' })
  reply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: SendSupportMessageDto,
  ) {
    return this.chats.reply(user, id, body.body);
  }
}
