import { UserRole } from '@industriallink/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'nam.nguyen@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'MatKhau@123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  password!: string;

  @ApiProperty({ example: 'Nguyễn Văn Nam' })
  @IsString()
  @MinLength(2)
  displayName!: string;

  @ApiProperty({ enum: [UserRole.Candidate, UserRole.Recruiter], example: UserRole.Candidate })
  @IsIn([UserRole.Candidate, UserRole.Recruiter])
  role!: UserRole.Candidate | UserRole.Recruiter;
}
