import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CmsContentType } from '@industriallink/contracts';
import { Public } from '../../shared/security/public.decorator';
import { CmsService } from './cms.service';

@ApiTags('CMS Public')
@Controller('cms')
export class CmsPublicController {
  constructor(private readonly cms: CmsService) {}

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'Danh mục CMS công khai' })
  listCategories() {
    return this.cms.listCategories();
  }

  @Public()
  @Get('posts')
  @ApiOperation({ summary: 'Bài viết / trang đã xuất bản' })
  listPosts(
    @Query('type') type?: CmsContentType,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
  ) {
    return this.cms.listPublished({
      type: type ?? CmsContentType.Post,
      category,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Public()
  @Get('posts/:slug')
  @ApiOperation({ summary: 'Chi tiết bài viết đã xuất bản (type=post)' })
  async getPost(@Param('slug') slug: string) {
    const post = await this.cms.getPublishedBySlug(CmsContentType.Post, slug);
    if (!post) throw new NotFoundException('Không tìm thấy bài viết');
    return post;
  }

  @Public()
  @Get('pages/:slug')
  @ApiOperation({ summary: 'Chi tiết trang tĩnh đã xuất bản' })
  async getPage(@Param('slug') slug: string) {
    const page = await this.cms.getPublishedBySlug(CmsContentType.Page, slug);
    if (!page) throw new NotFoundException('Không tìm thấy trang');
    return page;
  }

  @Public()
  @Get('redirect')
  @ApiOperation({ summary: 'Tra cứu redirect theo fromPath' })
  async lookupRedirect(@Query('from') from: string) {
    if (!from) throw new NotFoundException('Thiếu from');
    const row = await this.cms.resolveRedirect(from);
    if (!row) throw new NotFoundException('Không có redirect');
    return row;
  }

  @Public()
  @Get('menus/:location')
  @ApiOperation({ summary: 'Menu công khai theo vị trí (primary|footer)' })
  getMenu(@Param('location') location: string) {
    return this.cms.getMenuByLocation(location, true);
  }
}
