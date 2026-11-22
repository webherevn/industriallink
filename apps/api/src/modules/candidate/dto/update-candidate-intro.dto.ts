import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

class CandidateIntroSkillDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  level?: string;
}

export class UpdateCandidateIntroDto {
  @ApiPropertyOptional({
    description:
      'Giới thiệu bản thân (HTML định dạng hoặc văn bản thuần; truyền null/rỗng để quay về gợi ý AI)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(12000)
  summary?: string | null;

  @ApiPropertyOptional({
    description: 'Sở thích (mảng từ khóa hoặc 1 phần tử HTML định dạng phong phú)',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(12000, { each: true })
  hobbies?: string[];

  @ApiPropertyOptional({
    description: 'Danh sách kỹ năng cập nhật trực tiếp từ trang Thông tin ứng viên',
    type: [CandidateIntroSkillDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CandidateIntroSkillDto)
  skills?: CandidateIntroSkillDto[];
}
