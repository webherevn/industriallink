import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CmsContentStatus, CmsContentType, UserRole } from '@industriallink/contracts';
import { CurrentUser } from '../../shared/security/current-user.decorator';
import { JwtAuthGuard } from '../../shared/security/jwt-auth.guard';
import { Roles } from '../../shared/security/roles.decorator';
import { RolesGuard } from '../../shared/security/roles.guard';
import type { AuthenticatedUser } from '../../shared/security/security.types';
import { CmsService } from './cms.service';
import { UpdateCmsPostStatusDto } from './dto/update-cms-post-status.dto';
import { UpsertCmsCategoryDto } from './dto/upsert-cms-category.dto';
import { UpsertCmsPostDto } from './dto/upsert-cms-post.dto';
import { UpsertCmsRedirectDto } from './dto/upsert-cms-redirect.dto';

@ApiTags('Admin CMS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SuperAdmin)
@Controller('admin/cms')
export class CmsAdminController {
  constructor(private readonly cms: CmsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Tổng quan CMS / SEO' })
  overview() {
    return this.cms.seoOverview();
  }

  @Get('categories')
  @ApiOperation({ summary: 'Danh sách danh mục CMS' })
  listCategories() {
    return this.cms.listCategories();
  }

  @Post('categories')
  @ApiOperation({ summary: 'Tạo danh mục' })
  createCategory(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertCmsCategoryDto) {
    return this.cms.createCategory(user, dto);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Sửa danh mục' })
  updateCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpsertCmsCategoryDto,
  ) {
    return this.cms.updateCategory(user, id, dto);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Xoá mềm danh mục' })
  deleteCategory(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.cms.deleteCategory(user, id);
  }

  @Get('posts')
  @ApiOperation({ summary: 'Danh sách post/page (admin)' })
  listPosts(
    @Query('type') type?: CmsContentType,
    @Query('status') status?: CmsContentStatus,
    @Query('category') category?: string,
  ) {
    return this.cms.listPostsAdmin({ type, status, category });
  }

  @Get('posts/:id')
  @ApiOperation({ summary: 'Chi tiết post/page' })
  getPost(@Param('id') id: string) {
    return this.cms.getPostAdmin(id);
  }

  @Post('posts')
  @ApiOperation({ summary: 'Tạo post/page' })
  createPost(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertCmsPostDto) {
    return this.cms.createPost(user, dto);
  }

  @Patch('posts/:id')
  @ApiOperation({ summary: 'Sửa post/page' })
  updatePost(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpsertCmsPostDto,
  ) {
    return this.cms.updatePost(user, id, dto);
  }

  @Patch('posts/:id/status')
  @ApiOperation({ summary: 'Đổi trạng thái xuất bản' })
  setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCmsPostStatusDto,
  ) {
    return this.cms.setPostStatus(user, id, dto.status);
  }

  @Delete('posts/:id')
  @ApiOperation({ summary: 'Xoá mềm post/page' })
  deletePost(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.cms.deletePost(user, id);
  }

  @Get('redirects')
  @ApiOperation({ summary: 'Danh sách redirect 301' })
  listRedirects() {
    return this.cms.listRedirects();
  }

  @Post('redirects')
  @ApiOperation({ summary: 'Tạo/cập nhật redirect' })
  upsertRedirect(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertCmsRedirectDto) {
    return this.cms.upsertRedirect(user, dto);
  }

  @Delete('redirects/:id')
  @ApiOperation({ summary: 'Xoá redirect' })
  deleteRedirect(@Param('id') id: string) {
    return this.cms.deleteRedirect(id);
  }
}
