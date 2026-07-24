import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsString, MaxLength, ValidateNested } from 'class-validator';

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

  @IsArray()
  @IsString({ each: true })
  skills!: string[];

  @IsArray()
  @IsString({ each: true })
  softSkills!: string[];

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
