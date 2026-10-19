import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class ApiKeyIdDto {
  @IsUUID()
  apiKeyId: string;
}

export class UpdateApiKeyDto extends ApiKeyIdDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}
