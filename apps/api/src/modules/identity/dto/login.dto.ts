import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'nam.nguyen@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'MatKhau@123' })
  @IsString()
  password!: string;
}
