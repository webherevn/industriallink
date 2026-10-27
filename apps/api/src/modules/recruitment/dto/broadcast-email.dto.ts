import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApplicationStatus } from '@industriallink/contracts';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

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
    description: 'Lọc thêm theo một trạng thái khi không gửi applicationIds',
  })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @ApiPropertyOptional({
    type: [String],
    description: 'Hồ sơ được tick. Chỉ những hồ sơ thuộc tin này mới được gửi.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  applicationIds?: string[];
}
