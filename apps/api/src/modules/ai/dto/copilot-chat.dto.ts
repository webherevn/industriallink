import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CopilotChatDto {
  @ApiProperty({
    example: 'Tìm kỹ sư PLC Siemens 3 năm kinh nghiệm tại Bắc Ninh',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  message!: string;
}
