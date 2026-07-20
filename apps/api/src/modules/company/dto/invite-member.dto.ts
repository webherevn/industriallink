import { ApiProperty } from '@nestjs/swagger';
import { CompanyRole } from '@industriallink/contracts';
import { IsEmail, IsIn } from 'class-validator';

export class InviteMemberDto {
  @ApiProperty({ example: 'recruiter2@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: [CompanyRole.Admin, CompanyRole.Member], example: CompanyRole.Member })
  @IsIn([CompanyRole.Admin, CompanyRole.Member])
  roleInCompany!: CompanyRole.Admin | CompanyRole.Member;
}
