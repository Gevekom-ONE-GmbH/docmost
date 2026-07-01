import {
  IsArray,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

export enum PagePermissionRole {
  READER = 'reader',
  WRITER = 'writer',
}

export class PagePermissionPageIdDto {
  @IsUUID()
  pageId: string;
}

export class ListPagePermissionsDto extends PaginationOptions {
  @IsUUID()
  pageId: string;
}

export class AddPagePermissionDto {
  @IsUUID()
  pageId: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  userIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  groupIds?: string[];

  @IsEnum(PagePermissionRole)
  role: PagePermissionRole;
}

export class RemovePagePermissionDto {
  @IsUUID()
  pageId: string;

  @ValidateIf((o) => !o.groupId)
  @IsUUID()
  userId?: string;

  @ValidateIf((o) => !o.userId)
  @IsUUID()
  groupId?: string;
}

export class UpdatePagePermissionRoleDto {
  @IsUUID()
  pageId: string;

  @ValidateIf((o) => !o.groupId)
  @IsUUID()
  userId?: string;

  @ValidateIf((o) => !o.userId)
  @IsUUID()
  groupId?: string;

  @IsEnum(PagePermissionRole)
  role: PagePermissionRole;
}
