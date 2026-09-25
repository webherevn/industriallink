import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@industriallink/contracts';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { AdminUsersService } from './admin-users.service';
import { AdminCreateUserDto, AdminUpdateUserDto } from './dto/admin-user.dto';

@ApiTags('Admin Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SuperAdmin)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách người dùng (Superadmin)' })
  list() {
    return this.users.listUsers();
  }

  @Post()
  @ApiOperation({ summary: 'Tạo tài khoản + phân quyền' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: AdminCreateUserDto) {
    return this.users.createUser(user, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Sửa quyền / trạng thái / mật khẩu' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.users.updateUser(user, id, dto);
  }
}
