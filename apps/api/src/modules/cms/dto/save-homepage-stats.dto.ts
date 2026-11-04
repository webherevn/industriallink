import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { HOMEPAGE_STAT_ICONS } from '@industriallink/contracts';

class HomepageStatItemDto {
  @IsString()
  @MaxLength(48)
  value!: string;

  @IsString()
  @MaxLength(80)
  label!: string;

  @IsString()
  @IsIn(HOMEPAGE_STAT_ICONS)
  icon!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(500)
  imageUrl?: string | null;
}

export class SaveHomepageStatsDto {
  @ApiProperty({ type: [HomepageStatItemDto] })
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => HomepageStatItemDto)
  items!: HomepageStatItemDto[];
}
