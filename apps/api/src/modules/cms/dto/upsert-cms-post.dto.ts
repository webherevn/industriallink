import { CmsContentType } from '@industriallink/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MinLength, ValidateIf } from 'class-validator';

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
  seoTitle?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoDescription?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  canonicalPath?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ogImageUrl?: string | null;

  @ApiPropertyOptional({ example: 'index,follow' })
  @IsOptional()
  @IsString()
  robots?: string;

  @ApiPropertyOptional({ description: 'true = publish, false = draft' })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}
