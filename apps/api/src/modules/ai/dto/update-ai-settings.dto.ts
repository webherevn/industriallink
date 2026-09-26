import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { AiProviderKind, type UpdateAiSettingsRequest } from '@industriallink/contracts';

/** Cho phép giá trị null (xoá key) đi qua mà không bị IsString chặn. */
const NotNull = () => ValidateIf((_obj, value) => value !== null);

export class UpdateAiSettingsDto implements UpdateAiSettingsRequest {
  @IsOptional()
  @IsEnum(AiProviderKind)
  provider?: AiProviderKind;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8192)
  embeddingDim?: number;

  @IsOptional()
  @NotNull()
  @IsString()
  @MaxLength(500)
  openaiApiKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  openaiModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  openaiEmbeddingModel?: string;

  @IsOptional()
  @NotNull()
  @IsString()
  @MaxLength(500)
  anthropicApiKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  anthropicModel?: string;

  @IsOptional()
  @NotNull()
  @IsString()
  @MaxLength(500)
  geminiApiKey?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  geminiModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  geminiEmbeddingModel?: string;
}
