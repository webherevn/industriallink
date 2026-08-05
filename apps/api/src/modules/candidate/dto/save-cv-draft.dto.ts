import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

function nullOrNumber({ value }: { value: unknown }): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function nullOrBool({ value }: { value: unknown }): boolean | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return null;
}

class CvDraftExperienceDto {
  @IsString()
  @MaxLength(200)
  role!: string;

  @IsString()
  @MaxLength(200)
  company!: string;

  @IsString()
  @MaxLength(100)
  period!: string;

  @IsString()
  @MaxLength(4000)
  bullets!: string;

  @IsArray()
  @IsString({ each: true })
  industries!: string[];

  @IsArray()
  @IsString({ each: true })
  productsSold!: string[];

  @IsArray()
  @IsString({ each: true })
  customerSegments!: string[];

  @IsArray()
  @IsString({ each: true })
  marketsCovered!: string[];

  @IsArray()
  @IsString({ each: true })
  sellingStages!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrNumber)
  @IsNumber()
  latestRevenue!: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrNumber)
  @IsNumber()
  kpiAchievementPct!: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrNumber)
  @IsNumber()
  newCustomerRatioPct!: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  dealType!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrNumber)
  @IsNumber()
  typicalDealValue!: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrNumber)
  @IsNumber()
  maxDealValue!: number | null;
}

class CvDraftEducationDto {
  @IsString()
  @MaxLength(200)
  school!: string;

  @IsString()
  @MaxLength(200)
  degree!: string;

  @IsString()
  @MaxLength(100)
  period!: string;
}

class CvDraftProjectDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsString()
  @MaxLength(2000)
  detail!: string;
}

class CvDraftViewDto {
  @IsString()
  @MaxLength(200)
  fullName!: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(200)
  email!: string;

  @IsString()
  @MaxLength(50)
  phone!: string;

  @IsString()
  @MaxLength(200)
  location!: string;

  @IsString()
  @MaxLength(5000)
  summary!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrNumber)
  @IsNumber()
  birthYear!: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  birthDate!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  district!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  ward!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  educationLevel!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  careerObjective!: string | null;

  @IsArray()
  @IsString({ each: true })
  skills!: string[];

  @IsArray()
  @IsString({ each: true })
  softSkills!: string[];

  @IsArray()
  @IsString({ each: true })
  languages!: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hobbies!: string[];

  @IsArray()
  @IsString({ each: true })
  productsSold!: string[];

  @IsArray()
  @IsString({ each: true })
  customerSegments!: string[];

  @IsArray()
  @IsString({ each: true })
  marketsCovered!: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  industriesExperienced!: string[];

  @IsArray()
  @IsString({ each: true })
  desiredPositions!: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  desiredLocations!: string[];

  @IsString()
  @MaxLength(4000)
  salesHighlights!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  b2bExperienceBand!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrNumber)
  @IsNumber()
  newCustomerRatioPct!: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  dealType!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrNumber)
  @IsNumber()
  typicalDealValue!: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrNumber)
  @IsNumber()
  maxDealValue!: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  jobReadiness!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  availabilityBand!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrNumber)
  @IsNumber()
  expectedSalaryMin!: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrNumber)
  @IsNumber()
  expectedSalaryMax!: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrNumber)
  @IsNumber()
  expectedOte!: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  travelAbility!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrBool)
  @IsBoolean()
  hasB2License!: boolean | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  driverLicenseType!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  salesBehavior!: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  careerMotivations!: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  careerOrientations!: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  workStyles!: string[];

  @ApiPropertyOptional({ enum: ['sales', 'technical'], nullable: true })
  @IsOptional()
  @IsIn(['sales', 'technical'])
  jobTrack!: 'sales' | 'technical' | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  brandsTechnologies!: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  technicalWorkTypes!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrNumber)
  @IsNumber()
  technicalAutonomyLevel!: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrNumber)
  @IsNumber()
  troubleshootingLevel!: number | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  technicalTools!: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentLiteracy!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  systemScaleNote!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  shiftFlexibility!: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CvDraftExperienceDto)
  experience!: CvDraftExperienceDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CvDraftEducationDto)
  education!: CvDraftEducationDto[];

  @IsArray()
  @IsString({ each: true })
  certificates!: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CvDraftProjectDto)
  projects!: CvDraftProjectDto[];
}

export class SaveCvDraftDto {
  @ApiProperty({ description: 'Bản nháp CV đã chỉnh trong wizard' })
  @ValidateNested()
  @Type(() => CvDraftViewDto)
  draft!: CvDraftViewDto;
}
