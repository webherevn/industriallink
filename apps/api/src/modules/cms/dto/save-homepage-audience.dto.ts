import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, MaxLength, ValidateIf, ValidateNested } from 'class-validator';

class HomepageAudienceJobDto {
  @IsString()
  @MaxLength(80)
  title!: string;

  @IsString()
  @MaxLength(80)
  company!: string;

  @IsString()
  @MaxLength(60)
  location!: string;

  @IsString()
  @MaxLength(8)
  score!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(500)
  avatarUrl?: string | null;
}

export class SaveHomepageAudienceDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  kicker!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(140)
  title!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(400)
  subtitle!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(60)
  ctaLabel!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(300)
  ctaHref!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MaxLength(140, { each: true })
  points!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(500)
  imageUrl?: string | null;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  cardTitle!: string;

  @ApiProperty({ type: [HomepageAudienceJobDto] })
  @IsArray()
  @ArrayMinSize(3)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => HomepageAudienceJobDto)
  jobs!: HomepageAudienceJobDto[];
}
