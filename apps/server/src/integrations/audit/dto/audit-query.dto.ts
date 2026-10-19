import { IsOptional, IsString } from 'class-validator';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

export class AuditQueryDto extends PaginationOptions {
  @IsOptional()
  @IsString()
  event?: string;

  @IsOptional()
  @IsString()
  resourceType?: string;

  @IsOptional()
  @IsString()
  resourceId?: string;
}
