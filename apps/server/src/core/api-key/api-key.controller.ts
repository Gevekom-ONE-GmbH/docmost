import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { UserRole } from '../../common/helpers/types/permission';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { ApiKeyIdDto, CreateApiKeyDto, UpdateApiKeyDto } from './dto/api-key.dto';

@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  private isAdmin(user: User): boolean {
    return user.role === UserRole.OWNER || user.role === UserRole.ADMIN;
  }

  @HttpCode(HttpStatus.OK)
  @Post()
  async getApiKeys(
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    // Admins may list all workspace keys via adminView; everyone else sees only their own.
    const creatorId =
      this.isAdmin(user) && pagination.adminView ? undefined : user.id;
    return this.apiKeyService.getApiKeys(workspace.id, pagination, {
      creatorId,
    });
  }

  @HttpCode(HttpStatus.OK)
  @Post('create')
  async createApiKey(
    @Body() dto: CreateApiKeyDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.apiKeyService.createApiKey(dto, user.id, workspace.id);
  }

  @HttpCode(HttpStatus.OK)
  @Post('update')
  async updateApiKey(
    @Body() dto: UpdateApiKeyDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    return this.apiKeyService.updateApiKey(
      dto,
      user.id,
      workspace.id,
      this.isAdmin(user),
    );
  }

  @HttpCode(HttpStatus.OK)
  @Post('revoke')
  async revokeApiKey(
    @Body() dto: ApiKeyIdDto,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    await this.apiKeyService.revokeApiKey(
      dto.apiKeyId,
      user.id,
      workspace.id,
      this.isAdmin(user),
    );
    return { success: true };
  }
}
