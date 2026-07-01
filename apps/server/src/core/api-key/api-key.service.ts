import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeyRepo } from '@docmost/db/repos/api-key/api-key.repo';
import { UserRepo } from '@docmost/db/repos/user/user.repo';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { TokenService } from '../auth/services/token.service';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto/api-key.dto';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { JwtApiKeyPayload } from '../auth/dto/jwt-payload';
import { isUserDisabled } from '../../common/helpers';

@Injectable()
export class ApiKeyService {
  constructor(
    private readonly apiKeyRepo: ApiKeyRepo,
    private readonly userRepo: UserRepo,
    private readonly workspaceRepo: WorkspaceRepo,
    private readonly tokenService: TokenService,
  ) {}

  async createApiKey(
    dto: CreateApiKeyDto,
    userId: string,
    workspaceId: string,
  ) {
    const apiKey = await this.apiKeyRepo.insert({
      name: dto.name,
      creatorId: userId,
      workspaceId,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });

    // The plaintext token is only ever returned here, at creation time.
    const token = this.tokenService.generateApiKeyToken(
      userId,
      workspaceId,
      apiKey.id,
    );

    return { ...apiKey, token };
  }

  async getApiKeys(
    workspaceId: string,
    pagination: PaginationOptions,
    opts?: { creatorId?: string },
  ) {
    return this.apiKeyRepo.getWorkspaceApiKeysPaginated(
      workspaceId,
      pagination,
      opts,
    );
  }

  async updateApiKey(
    dto: UpdateApiKeyDto,
    userId: string,
    workspaceId: string,
    isAdmin: boolean,
  ) {
    await this.assertCanManage(dto.apiKeyId, userId, workspaceId, isAdmin);
    await this.apiKeyRepo.update({ name: dto.name }, dto.apiKeyId, workspaceId);
    return this.apiKeyRepo.findById(dto.apiKeyId, workspaceId, {
      includeCreator: true,
    });
  }

  async revokeApiKey(
    apiKeyId: string,
    userId: string,
    workspaceId: string,
    isAdmin: boolean,
  ) {
    await this.assertCanManage(apiKeyId, userId, workspaceId, isAdmin);
    await this.apiKeyRepo.revoke(apiKeyId, workspaceId);
  }

  private async assertCanManage(
    apiKeyId: string,
    userId: string,
    workspaceId: string,
    isAdmin: boolean,
  ) {
    const existing = await this.apiKeyRepo.findById(apiKeyId, workspaceId);
    if (!existing) {
      throw new NotFoundException('API key not found');
    }
    if (existing.creatorId !== userId && !isAdmin) {
      throw new ForbiddenException(
        'You do not have permission to manage this API key',
      );
    }
  }

  /**
   * Called from JwtStrategy when a request presents an api_key token.
   * Enforces expiry and revocation against the api_keys table.
   */
  async validateApiKey(payload: JwtApiKeyPayload) {
    const apiKey = await this.apiKeyRepo.findById(
      payload.apiKeyId,
      payload.workspaceId,
    );
    if (!apiKey) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      throw new UnauthorizedException('API key expired');
    }

    const workspace = await this.workspaceRepo.findById(payload.workspaceId);
    if (!workspace) {
      throw new UnauthorizedException();
    }

    const user = await this.userRepo.findById(payload.sub, payload.workspaceId);
    if (!user || isUserDisabled(user)) {
      throw new UnauthorizedException();
    }

    // best-effort last-used tracking; must not block the request
    void this.apiKeyRepo.updateLastUsedAt(apiKey.id);

    return { user, workspace };
  }
}
