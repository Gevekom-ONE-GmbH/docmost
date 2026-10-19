import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';

/** Events a webhook may subscribe to ('*' = all). */
export const WEBHOOK_EVENTS = [
  'page.created',
  'page.updated',
  'page.deleted',
  'page.soft_deleted',
  'page.restored',
  'space.created',
  'space.updated',
  'space.deleted',
  'workspace.created',
  'workspace.updated',
  'workspace.deleted',
] as const;

const ALLOWED = [...WEBHOOK_EVENTS, '*'];

export class CreateWebhookDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  secret?: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(ALLOWED, { each: true })
  events: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class WebhookIdDto {
  @IsUUID()
  webhookId: string;
}

export class UpdateWebhookDto extends WebhookIdDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  secret?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(ALLOWED, { each: true })
  events?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
