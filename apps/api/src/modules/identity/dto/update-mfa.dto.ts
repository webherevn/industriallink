import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateMfaDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  enabled!: boolean;
}
