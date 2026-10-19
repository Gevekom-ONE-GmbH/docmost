import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

export enum VerificationType {
  EXPIRING = 'expiring',
  QMS = 'qms',
}

export enum ExpirationMode {
  PERIOD = 'period',
  FIXED = 'fixed',
  INDEFINITE = 'indefinite',
}

export enum PeriodUnit {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}

export class PageVerificationPageIdDto {
  @IsUUID()
  pageId: string;
}

export class SetupVerificationDto {
  @IsUUID()
  pageId: string;

  @IsOptional()
  @IsEnum(VerificationType)
  type?: VerificationType;

  @IsOptional()
  @IsEnum(ExpirationMode)
  mode?: ExpirationMode;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  periodAmount?: number;

  @IsOptional()
  @IsEnum(PeriodUnit)
  periodUnit?: PeriodUnit;

  @IsOptional()
  @IsDateString()
  fixedExpiresAt?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  verifierIds?: string[];

  @IsOptional()
  @IsUUID()
  primaryVerifierId?: string;
}

export class UpdateVerificationDto extends SetupVerificationDto {}

export class RejectApprovalDto {
  @IsUUID()
  pageId: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class ListVerificationsDto extends PaginationOptions {
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  spaceIds?: string[];

  @IsOptional()
  @IsEnum(VerificationType)
  type?: VerificationType;
}
