import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';
import { PageAccessService } from '../page-access/page-access.service';
import { User } from '@docmost/db/types/entity.types';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../../integrations/audit/audit.service';
import { AuditEvent, AuditResource } from '../../../common/events/audit-events';
import {
  AddPagePermissionDto,
  ListPagePermissionsDto,
  PagePermissionRole,
  RemovePagePermissionDto,
  UpdatePagePermissionRoleDto,
} from './dto/page-permission.dto';

@Injectable()
export class PagePermissionService {
  constructor(
    private readonly pageRepo: PageRepo,
    private readonly pagePermissionRepo: PagePermissionRepo,
    private readonly pageAccessService: PageAccessService,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
  ) {}

  private logAudit(event: string, page: any) {
    this.auditService.log({
      event: event as any,
      resourceType: AuditResource.PAGE,
      resourceId: page.id,
      spaceId: page.spaceId,
    });
  }

  private async getPageOrThrow(pageId: string) {
    const page = await this.pageRepo.findById(pageId);
    if (!page || page.deletedAt) {
      throw new NotFoundException('Page not found');
    }
    return page;
  }

  private async canManage(page: any, user: User): Promise<boolean> {
    try {
      await this.pageAccessService.validateCanEdit(page, user);
      return true;
    } catch {
      return false;
    }
  }

  async getPermissionInfo(pageId: string, user: User) {
    const page = await this.getPageOrThrow(pageId);
    await this.pageAccessService.validateCanView(page, user);

    const pageAccess =
      await this.pagePermissionRepo.findPageAccessByPageId(pageId);
    const level = await this.pagePermissionRepo.getUserPageAccessLevel(
      user.id,
      pageId,
    );
    const canManage = await this.canManage(page, user);

    return {
      pageId,
      pageAccessId: pageAccess?.id ?? null,
      hasDirectRestriction: !!pageAccess,
      hasInheritedRestriction:
        level.hasInheritedRestriction ?? level.hasAnyRestriction,
      hasAnyRestriction: level.hasAnyRestriction,
      userAccess: {
        canView: level.canAccess,
        canEdit: level.canEdit,
        canManage,
      },
    };
  }

  async listPermissions(dto: ListPagePermissionsDto, user: User) {
    const page = await this.getPageOrThrow(dto.pageId);
    await this.pageAccessService.validateCanView(page, user);

    const pageAccess = await this.pagePermissionRepo.findPageAccessByPageId(
      dto.pageId,
    );
    if (!pageAccess) {
      return {
        items: [],
        meta: {
          limit: dto.limit,
          hasNextPage: false,
          hasPrevPage: false,
          nextCursor: null,
          prevCursor: null,
        },
      };
    }

    return this.pagePermissionRepo.getPagePermissionsPaginated(
      pageAccess.id,
      dto,
    );
  }

  /** Ensure a page_access row exists; create it and seed the acting user as writer. */
  private async ensureRestricted(page: any, user: User) {
    let pageAccess = await this.pagePermissionRepo.findPageAccessByPageId(
      page.id,
    );
    if (pageAccess) return pageAccess;

    pageAccess = await this.pagePermissionRepo.insertPageAccess({
      pageId: page.id,
      workspaceId: page.workspaceId,
      spaceId: page.spaceId,
      accessLevel: 'restricted',
      creatorId: user.id,
    });

    // Seed the acting user as a writer so they don't lock themselves out.
    await this.pagePermissionRepo.insertPagePermissions([
      {
        pageAccessId: pageAccess.id,
        userId: user.id,
        role: PagePermissionRole.WRITER,
        addedById: user.id,
      },
    ]);

    return pageAccess;
  }

  async restrictPage(pageId: string, user: User) {
    const page = await this.getPageOrThrow(pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    await this.ensureRestricted(page, user);
    this.logAudit(AuditEvent.PAGE_RESTRICTED, page);
    return this.getPermissionInfo(pageId, user);
  }

  async removeRestriction(pageId: string, user: User) {
    const page = await this.getPageOrThrow(pageId);
    await this.pageAccessService.validateCanEdit(page, user);
    await this.pagePermissionRepo.deletePageAccess(pageId);
    this.logAudit(AuditEvent.PAGE_RESTRICTION_REMOVED, page);
    return this.getPermissionInfo(pageId, user);
  }

  async addPermissions(dto: AddPagePermissionDto, user: User) {
    const page = await this.getPageOrThrow(dto.pageId);
    await this.pageAccessService.validateCanEdit(page, user);

    const userIds = dto.userIds ?? [];
    const groupIds = dto.groupIds ?? [];
    if (userIds.length === 0 && groupIds.length === 0) {
      throw new BadRequestException('No users or groups provided');
    }

    const pageAccess = await this.ensureRestricted(page, user);

    const toInsert = [];
    for (const userId of userIds) {
      const existing = await this.pagePermissionRepo.findPagePermissionByUserId(
        pageAccess.id,
        userId,
      );
      if (!existing) {
        toInsert.push({
          pageAccessId: pageAccess.id,
          userId,
          role: dto.role,
          addedById: user.id,
        });
      }
    }
    for (const groupId of groupIds) {
      const existing =
        await this.pagePermissionRepo.findPagePermissionByGroupId(
          pageAccess.id,
          groupId,
        );
      if (!existing) {
        toInsert.push({
          pageAccessId: pageAccess.id,
          groupId,
          role: dto.role,
          addedById: user.id,
        });
      }
    }

    await this.pagePermissionRepo.insertPagePermissions(toInsert);
    this.logAudit(AuditEvent.PAGE_PERMISSION_ADDED, page);
    return this.getPermissionInfo(dto.pageId, user);
  }

  async updatePermissionRole(dto: UpdatePagePermissionRoleDto, user: User) {
    const page = await this.getPageOrThrow(dto.pageId);
    await this.pageAccessService.validateCanEdit(page, user);

    const pageAccess = await this.pagePermissionRepo.findPageAccessByPageId(
      dto.pageId,
    );
    if (!pageAccess) {
      throw new NotFoundException('Page is not restricted');
    }

    // Prevent demoting the last remaining writer to reader (avoids lock-out).
    if (dto.role === PagePermissionRole.READER) {
      await this.assertNotLastWriter(pageAccess.id, dto);
    }

    await this.pagePermissionRepo.updatePagePermissionRole(
      pageAccess.id,
      dto.role,
      { userId: dto.userId, groupId: dto.groupId },
    );
    return this.getPermissionInfo(dto.pageId, user);
  }

  async removePermission(dto: RemovePagePermissionDto, user: User) {
    const page = await this.getPageOrThrow(dto.pageId);
    await this.pageAccessService.validateCanEdit(page, user);

    const pageAccess = await this.pagePermissionRepo.findPageAccessByPageId(
      dto.pageId,
    );
    if (!pageAccess) {
      throw new NotFoundException('Page is not restricted');
    }

    await this.assertNotLastWriter(pageAccess.id, dto);

    if (dto.userId) {
      await this.pagePermissionRepo.deletePagePermissionByUserId(
        pageAccess.id,
        dto.userId,
      );
    } else if (dto.groupId) {
      await this.pagePermissionRepo.deletePagePermissionByGroupId(
        pageAccess.id,
        dto.groupId,
      );
    }
    this.logAudit(AuditEvent.PAGE_PERMISSION_REMOVED, page);
    return this.getPermissionInfo(dto.pageId, user);
  }

  /**
   * Guards against removing/demoting the only writer, which would leave the
   * restricted page unmanageable.
   */
  private async assertNotLastWriter(
    pageAccessId: string,
    target: { userId?: string; groupId?: string },
  ) {
    const writerCount =
      await this.pagePermissionRepo.countWritersByPageAccessId(pageAccessId);
    if (writerCount > 1) return;

    const current = target.userId
      ? await this.pagePermissionRepo.findPagePermissionByUserId(
          pageAccessId,
          target.userId,
        )
      : await this.pagePermissionRepo.findPagePermissionByGroupId(
          pageAccessId,
          target.groupId,
        );

    if (current?.role === PagePermissionRole.WRITER) {
      throw new BadRequestException(
        'Cannot remove or demote the last writer of a restricted page',
      );
    }
  }
}
