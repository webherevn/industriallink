import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpsertCmsSiteCodeSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  headerEnabled?: boolean;

  @ApiPropertyOptional({ description: 'HTML/JS chèn trong <head>' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(200_000)
  headerCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  footerEnabled?: boolean;

  @ApiPropertyOptional({ description: 'HTML/JS chèn trước </body>' })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(200_000)
  footerCode?: string;
}
