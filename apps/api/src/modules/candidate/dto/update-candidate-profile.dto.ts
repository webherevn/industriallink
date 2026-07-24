import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
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

class ProfileSkillDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(40)
  level!: string;
}

class ExperienceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string | null;

  @IsString()
  @MaxLength(200)
  companyName!: string;

  @IsString()
  @MaxLength(200)
  jobTitle!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrNumber)
  @IsNumber()
  startYear!: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrNumber)
  @IsNumber()
  endYear!: number | null;

  @IsBoolean()
  isCurrent!: boolean;

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
  @IsString()
  revenueBand!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrNumber)
  @IsNumber()
  latestRevenue!: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  kpiBand!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrNumber)
  @IsNumber()
  kpiAchievementPct!: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  newCustomerRatioBand!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrNumber)
  @IsNumber()
  newCustomerRatioPct!: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dealType!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  typicalDealValueBand!: string | null;

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
  maxDealRole!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  highlights!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  jobDescription!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  missingFields?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;
}

export class UpdateCandidateProfileDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  displayName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrNumber)
  @IsNumber()
  birthYear!: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  currentCity!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  currentPosition!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  jobLevel!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrNumber)
  @IsNumber()
  totalExperienceYears!: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  industry!: string | null;

  @IsArray()
  @IsString({ each: true })
  industriesExperienced!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  specialization!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  summary!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  careerObjective!: string | null;

  @IsArray()
  @IsString({ each: true })
  productsSold!: string[];

  @IsArray()
  @IsString({ each: true })
  customerSegments!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  b2bExperienceBand!: string | null;

  @IsArray()
  @IsString({ each: true })
  marketsCovered!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  salesHighlights!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  customerDevStyle!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  dealType!: string | null;

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
  @Transform(nullOrNumber)
  @IsNumber()
  typicalDealValue!: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(nullOrNumber)
  @IsNumber()
  maxDealValue!: number | null;

  @IsArray()
  @IsString({ each: true })
  sellingStages!: string[];

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
  noticePeriodDays!: number | null;

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

  @IsArray()
  @IsString({ each: true })
  languages!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hasB2License!: boolean | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  driverLicenseType!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  willingToTravel!: boolean | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  travelAbility!: string | null;

  @IsArray()
  @IsString({ each: true })
  desiredPositions!: string[];

  @IsArray()
  @IsString({ each: true })
  desiredLocations!: string[];

  @IsArray()
  @IsString({ each: true })
  careerMotivations!: string[];

  @IsArray()
  @IsString({ each: true })
  workStyles!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  careerOrientation!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  educationLevel!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  educationSchool!: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  educationMajor!: string | null;

  @IsArray()
  @IsString({ each: true })
  certificates!: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileSkillDto)
  skills!: ProfileSkillDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExperienceDto)
  experiences!: ExperienceDto[];
}
