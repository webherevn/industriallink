import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { HOMEPAGE_STEP_ICONS } from '@industriallink/contracts';

class HomepageStepItemDto {
  @IsString()
  @MaxLength(80)
  title!: string;

  @IsString()
  @MaxLength(280)
  description!: string;

  @IsString()
  @IsIn(HOMEPAGE_STEP_ICONS)
  icon!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(500)
  imageUrl?: string | null;
}

export class SaveHomepageStepsDto {
  @ApiProperty()
  @IsString()
  @MaxLength(140)
  title!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(40)
  titleAccent!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(240)
  subtitle!: string;

  @ApiProperty({ type: [HomepageStepItemDto] })
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => HomepageStepItemDto)
  items!: HomepageStepItemDto[];
}
