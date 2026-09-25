import { CmsContentType, type CmsFaqItem } from '@industriallink/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

class CmsFaqItemDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  question!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  answer!: string;
}

export class UpsertCmsPostDto {
  @ApiProperty({ enum: CmsContentType })
  @IsEnum(CmsContentType)
  type!: CmsContentType;

  @ApiProperty({ example: 'Cách viết CV kỹ sư tự động hoá' })
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiPropertyOptional({ example: 'cach-viet-cv-ky-su-tu-dong-hoa' })
  @IsOptional()
  @IsString()
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  excerpt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined && v !== '')
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImageUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorName?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorTitle?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorBio?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoTitle?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoDescription?: string | null;

  @ApiPropertyOptional({ description: 'Focus keyphrase (Yoast/Rank Math)' })
  @IsOptional()
  @IsString()
  focusKeyword?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  canonicalPath?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ogTitle?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ogDescription?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ogImageUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  robotsIndex?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  robotsFollow?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  robotsMaxImagePreview?: boolean;

  @ApiPropertyOptional({ type: [CmsFaqItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CmsFaqItemDto)
  faq?: CmsFaqItem[];

  @ApiPropertyOptional({ description: 'true = publish, false = draft' })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;

  @ApiPropertyOptional({ description: 'ISO datetime — chỉnh ngày đăng' })
  @IsOptional()
  @IsString()
  publishedAt?: string | null;
}
