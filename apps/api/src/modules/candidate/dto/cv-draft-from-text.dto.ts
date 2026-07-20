import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CvDraftFromTextDto {
  @ApiProperty({
    description: 'Văn bản tự do mô tả bản thân / kinh nghiệm / học vấn',
    example:
      'Tôi tên Nguyễn Văn A, kỹ sư PLC 5 năm tại Công ty ABC. Email a@gmail.com, SĐT 0901234567. Thành thạo Siemens, SCADA. Tốt nghiệp ĐH Bách Khoa 2019.',
  })
  @IsString()
  @MinLength(40, { message: 'Vui lòng nhập ít nhất khoảng 40 ký tự để AI phân tích' })
  @MaxLength(20000)
  text!: string;
}
