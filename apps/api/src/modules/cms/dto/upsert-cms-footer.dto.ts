import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
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
  @ApiProperty({ type: CmsFooterBlockDto })
  @ValidateNested()
  @Type(() => CmsFooterBlockDto)
  footer1!: CmsFooterBlockDto;

  @ApiProperty({ type: CmsFooterBlockDto })
  @ValidateNested()
  @Type(() => CmsFooterBlockDto)
  footer2!: CmsFooterBlockDto;

  @ApiProperty({ example: '©2026 Inlink Vietnam JSC. All rights reserved.' })
  @IsString()
  @MaxLength(500)
  copyrightText!: string;
}
