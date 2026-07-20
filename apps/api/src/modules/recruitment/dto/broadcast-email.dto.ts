import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '@industriallink/contracts';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class BroadcastEmailDto {
  @ApiProperty({ example: 'Cập nhật lịch phỏng vấn vòng 2' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  subject!: string;

  @ApiProperty({
    example: 'Xin chào,\n\nChúng tôi muốn thông báo lịch PV vòng 2 vào tuần tới...',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  body!: string;

  @ApiPropertyOptional({
    enum: ApplicationStatus,
    description: 'Chỉ gửi cho ứng viên ở trạng thái này (mặc định: tất cả)',
  })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;
}
