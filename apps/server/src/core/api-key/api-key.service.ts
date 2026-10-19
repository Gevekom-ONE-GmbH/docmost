import {
  BadRequestException,
  ForbiddenException,
  Inject,
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
import { User, Workspace } from '@docmost/db/types/entity.types';
import { UserRole } from '../../common/helpers/types/permission';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../integrations/audit/audit.service';
import { AuditEvent, AuditResource } from '../../common/events/audit-events';

// API keys without an explicit expiry are long-lived JWTs; revocation and
// expiry are always enforced against the api_keys table in validateApiKey().
const DEFAULT_API_KEY_TTL = '3650d';

@Injectable()
export class ApiKeyService {
  constructor(
    private readonly apiKeyRepo: ApiKeyRepo,
    private readonly userRepo: UserRepo,
    private readonly workspaceRepo: WorkspaceRepo,
    private readonly tokenService: TokenService,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  static isAdmin(user: Pick<User, 'role'>): boolean {
    return user.role === UserRole.OWNER || user.role === UserRole.ADMIN;
  }

  /** Workspace setting "restrict API access to admins" (settings.api.restrictToAdmins). */
  static isRestrictedToAdmins(workspace: Pick<Workspace, 'settings'>): boolean {
    return (workspace?.settings as any)?.api?.restrictToAdmins === true;
  }

  async createApiKey(dto: CreateApiKeyDto, user: User, workspace: Workspace) {
    if (
      ApiKeyService.isRestrictedToAdmins(workspace) &&
      !ApiKeyService.isAdmin(user)
    ) {
      throw new ForbiddenException(
        'API key creation is restricted to workspace admins',
      );
    }

    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Expiration date must be in the future');
    }

    const apiKey = await this.apiKeyRepo.insert({
      name: dto.name,
      creatorId: user.id,
      workspaceId: workspace.id,
      expiresAt,
    });

    // The plaintext token is only ever returned here, at creation time.
    const token = await this.tokenService.generateApiToken({
      apiKeyId: apiKey.id,
      user,
      workspaceId: workspace.id,
      expiresIn: expiresAt
        ? Math.ceil((expiresAt.getTime() - Date.now()) / 1000)
        : DEFAULT_API_KEY_TTL,
    });

    this.auditService.log({
      event: AuditEvent.API_KEY_CREATED,
      resourceType: AuditResource.API_KEY,
      resourceId: apiKey.id,
      changes: {
        after: { name: apiKey.name, expiresAt: apiKey.expiresAt },
      },
    });

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
    const existing = await this.assertCanManage(
      dto.apiKeyId,
      userId,
      workspaceId,
      isAdmin,
    );
    await this.apiKeyRepo.update({ name: dto.name }, dto.apiKeyId, workspaceId);

    if (existing.name !== dto.name) {
      this.auditService.log({
        event: AuditEvent.API_KEY_UPDATED,
        resourceType: AuditResource.API_KEY,
        resourceId: dto.apiKeyId,
        changes: {
          before: { name: existing.name },
          after: { name: dto.name },
        },
      });
    }

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
    const existing = await this.assertCanManage(
      apiKeyId,
      userId,
      workspaceId,
      isAdmin,
    );
    await this.apiKeyRepo.revoke(apiKeyId, workspaceId);

    this.auditService.log({
      event: AuditEvent.API_KEY_DELETED,
      resourceType: AuditResource.API_KEY,
      resourceId: apiKeyId,
      changes: {
        before: { name: existing.name, creatorId: existing.creatorId },
      },
    });
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
    return existing;
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
    if (!apiKey || apiKey.creatorId !== payload.sub) {
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

    if (
      ApiKeyService.isRestrictedToAdmins(workspace) &&
      !ApiKeyService.isAdmin(user)
    ) {
      throw new UnauthorizedException(
        'API access is restricted to workspace admins',
      );
    }

    this.auditService.setActorType('api_key');

    // best-effort last-used tracking; must not block the request
    void this.apiKeyRepo.updateLastUsedAt(apiKey.id).catch(() => undefined);

    return { user, workspace };
  }
}
