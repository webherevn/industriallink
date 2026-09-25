import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
import { SaveCmsMenuDto } from './dto/save-cms-menu.dto';
import { UpdateCmsPostStatusDto } from './dto/update-cms-post-status.dto';
import { UpsertCmsAuthorProfileDto, AssignCmsAuthorProfileDto } from './dto/upsert-cms-author-profile.dto';
import { UpsertCmsCategoryDto } from './dto/upsert-cms-category.dto';
import { UpsertCmsFooterSettingsDto } from './dto/upsert-cms-footer.dto';
import { UpsertCmsHomepageSettingsDto } from './dto/upsert-cms-homepage.dto';
import { UpsertCmsPostDto } from './dto/upsert-cms-post.dto';
import { UpsertCmsRedirectDto } from './dto/upsert-cms-redirect.dto';
import { UpsertCmsRobotsSettingsDto } from './dto/upsert-cms-robots.dto';
import { UpsertCmsSiteCodeSettingsDto } from './dto/upsert-cms-site-code.dto';

@ApiTags('Admin CMS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SuperAdmin, UserRole.Editor)
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

  @Get('menus/:location')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Lấy menu theo vị trí (primary|footer)' })
  getMenu(@Param('location') location: string) {
    return this.cms.getMenuByLocation(location, true);
  }

  @Put('menus/:location')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Lưu toàn bộ menu (kiểu WP Menus)' })
  saveMenu(
    @CurrentUser() user: AuthenticatedUser,
    @Param('location') location: string,
    @Body() dto: SaveCmsMenuDto,
  ) {
    return this.cms.saveMenu(user, location, dto);
  }

  @Get('footer')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Cấu hình chân trang (Footer 1/2 + copyright)' })
  getFooter() {
    return this.cms.getFooterSettings();
  }

  @Put('footer')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Lưu cấu hình chân trang' })
  saveFooter(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertCmsFooterSettingsDto) {
    return this.cms.saveFooterSettings(user, dto);
  }

  @Get('homepage')
  @ApiOperation({ summary: 'SEO & hero trang chủ' })
  getHomepage() {
    return this.cms.getHomepageSettings();
  }

  @Put('homepage')
  @ApiOperation({ summary: 'Lưu SEO & hero trang chủ' })
  saveHomepage(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertCmsHomepageSettingsDto,
  ) {
    return this.cms.saveHomepageSettings(user, dto);
  }

  @Get('robots')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'robots.txt (RankMath-style)' })
  getRobots() {
    return this.cms.getRobotsSettings();
  }

  @Put('robots')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Lưu robots.txt custom' })
  saveRobots(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertCmsRobotsSettingsDto,
  ) {
    return this.cms.saveRobotsSettings(user, dto);
  }

  @Delete('robots')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Xoá robots.txt custom → về mặc định' })
  deleteRobots(@CurrentUser() user: AuthenticatedUser) {
    return this.cms.deleteRobotsSettings(user);
  }

  @Get('site-code')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Insert Headers and Footers' })
  getSiteCode() {
    return this.cms.getSiteCodeSettings();
  }

  @Put('site-code')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Lưu mã Header / Footer' })
  saveSiteCode(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertCmsSiteCodeSettingsDto,
  ) {
    return this.cms.saveSiteCodeSettings(user, dto);
  }

  @Get('author-profiles')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Danh sách hồ sơ tác giả (SuperAdmin)' })
  listAuthorProfiles() {
    return this.cms.listAuthorProfiles();
  }

  @Get('author-profiles/eligible-users')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Tài khoản chưa có hồ sơ — để gán tác giả' })
  listEligibleAuthorUsers() {
    return this.cms.listUsersWithoutAuthorProfile();
  }

  @Get('author-profiles/:userId')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Chi tiết hồ sơ tác giả theo userId' })
  getAuthorProfileByUser(@Param('userId') userId: string) {
    return this.cms.getAuthorProfileAdmin(userId);
  }

  @Post('author-profiles')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Gán / tạo hồ sơ tác giả cho tài khoản' })
  assignAuthorProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AssignCmsAuthorProfileDto,
  ) {
    return this.cms.assignAuthorProfile(user, dto);
  }

  @Put('author-profiles/:userId')
  @Roles(UserRole.SuperAdmin)
  @ApiOperation({ summary: 'Cập nhật hồ sơ tác giả (SuperAdmin)' })
  updateAuthorProfileByUser(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() dto: UpsertCmsAuthorProfileDto,
  ) {
    return this.cms.updateAuthorProfileAdmin(user, userId, dto);
  }

  @Get('author-profile')
  @ApiOperation({ summary: 'Hồ sơ tác giả của tài khoản đang đăng nhập' })
  getAuthorProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.cms.getMyAuthorProfile(user);
  }

  @Put('author-profile')
  @ApiOperation({ summary: 'Cập nhật hồ sơ tác giả của chính mình' })
  updateAuthorProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpsertCmsAuthorProfileDto,
  ) {
    return this.cms.updateMyAuthorProfile(user, dto);
  }
}
