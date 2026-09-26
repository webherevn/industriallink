import { IsEnum, IsOptional } from 'class-validator';
import { AiProviderKind, type TestAiConnectionRequest } from '@industriallink/contracts';

export class TestAiConnectionDto implements TestAiConnectionRequest {
  @IsOptional()
  @IsEnum(AiProviderKind)
  provider?: AiProviderKind;
}
