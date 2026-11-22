import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

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
}
