import { JobTrack } from '@industriallink/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ParseJobDescriptionDto {
  @ApiProperty({
    description: 'Nội dung JD dán từ Word/PDF hoặc soạn tay',
    example:
      'Tuyển Nhân viên kinh doanh B2B máy nén khí, làm việc tại KCN Bắc Ninh. Kinh nghiệm 1-3 năm. Lương 15-25 triệu. Bán cho nhà máy FDI, phụ trách miền Bắc.',
  })
  @IsString()
  @MinLength(40, { message: 'Vui lòng nhập ít nhất khoảng 40 ký tự để AI đọc JD' })
  @MaxLength(40000)
  text!: string;

  @ApiPropertyOptional({ enum: JobTrack, description: 'sales = 22 trường; technical = 23 trường' })
  @IsOptional()
  @IsEnum(JobTrack)
  jobTrack?: JobTrack;
}
