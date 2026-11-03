import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

class HomepageHeroPersonDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsString()
  @MaxLength(160)
  detail!: string;

  @IsString()
  @MaxLength(16)
  score!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(500)
  avatarUrl?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];
}

class HomepageHeroJobDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(120)
  company!: string;

  @IsString()
  @MaxLength(80)
  location!: string;

  @IsString()
  @MaxLength(16)
  score!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(500)
  iconUrl?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  tags?: string[];
}

export class SaveHomepageHeroDto {
  @ApiProperty()
  @IsString()
  @MaxLength(160)
  eyebrow!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(240)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  titleAccent?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  subtitle!: string;

  @IsString()
  @MaxLength(60)
  primaryLabel!: string;

  @IsString()
  @MaxLength(60)
  primaryHint!: string;

  @IsString()
  @MaxLength(300)
  primaryHref!: string;

  @IsString()
  @MaxLength(60)
  secondaryLabel!: string;

  @IsString()
  @MaxLength(60)
  secondaryHint!: string;

  @IsString()
  @MaxLength(300)
  secondaryHref!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(500)
  imageUrl?: string | null;

  @IsString()
  @MaxLength(80)
  candidatesTitle!: string;

  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => HomepageHeroPersonDto)
  candidates!: HomepageHeroPersonDto[];

  @IsString()
  @MaxLength(80)
  jobsTitle!: string;

  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => HomepageHeroJobDto)
  jobs!: HomepageHeroJobDto[];
}
