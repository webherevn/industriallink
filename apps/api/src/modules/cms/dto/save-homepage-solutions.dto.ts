import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { HOMEPAGE_SOLUTION_ICONS } from '@industriallink/contracts';

class HomepageSolutionItemDto {
  @IsString()
  @MaxLength(80)
  title!: string;

  @IsString()
  @MaxLength(240)
  description!: string;

  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  points!: string[];

  @IsString()
  @IsIn(HOMEPAGE_SOLUTION_ICONS)
  icon!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(500)
  imageUrl?: string | null;

  @IsString()
  @MaxLength(300)
  href!: string;
}

export class SaveHomepageSolutionsDto {
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
  @MaxLength(280)
  subtitle!: string;

  @ApiProperty({ type: [HomepageSolutionItemDto] })
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => HomepageSolutionItemDto)
  items!: HomepageSolutionItemDto[];
}
