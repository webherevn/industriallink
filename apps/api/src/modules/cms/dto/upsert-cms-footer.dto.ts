import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { CmsStructuredFooter } from '@industriallink/contracts';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CmsFooterColumnDto {
  @ApiProperty({ description: 'HTML rich text cột footer' })
  @IsString()
  @MaxLength(20000)
  html!: string;
}

export class CmsFooterBlockDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ type: [CmsFooterColumnDto], minItems: 4, maxItems: 4 })
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => CmsFooterColumnDto)
  columns!: CmsFooterColumnDto[];
}

export class UpsertCmsFooterSettingsDto {
  @ApiPropertyOptional({ type: CmsFooterBlockDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CmsFooterBlockDto)
  footer1?: CmsFooterBlockDto;

  @ApiPropertyOptional({ type: CmsFooterBlockDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CmsFooterBlockDto)
  footer2?: CmsFooterBlockDto;

  @ApiPropertyOptional({ description: 'Cấu trúc chân trang chuẩn inLink (5 cột + pháp lý)' })
  @IsOptional()
  @IsObject()
  structured?: CmsStructuredFooter | null;

  @ApiProperty({ example: '©2026 Inlink Vietnam JSC. All rights reserved.' })
  @IsString()
  @MaxLength(500)
  copyrightText!: string;
}
