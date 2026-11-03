import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { HOMEPAGE_REASON_ICONS } from '@industriallink/contracts';

class HomepageReasonItemDto {
  @IsString()
  @MaxLength(80)
  title!: string;

  @IsString()
  @MaxLength(240)
  description!: string;

  @IsString()
  @IsIn(HOMEPAGE_REASON_ICONS)
  icon!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(500)
  imageUrl?: string | null;
}

export class SaveHomepageReasonsDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  title!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(40)
  titleAccent!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(240)
  subtitle!: string;

  @ApiProperty({ type: [HomepageReasonItemDto] })
  @IsArray()
  @ArrayMinSize(5)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => HomepageReasonItemDto)
  items!: HomepageReasonItemDto[];
}
