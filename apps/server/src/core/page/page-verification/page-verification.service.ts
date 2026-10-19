import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  AUDIT_SERVICE,
  IAuditService,
} from '../../../integrations/audit/audit.service';
import { AuditEvent, AuditResource } from '../../../common/events/audit-events';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { PageVerificationRepo } from '@docmost/db/repos/page/page-verification.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PageAccessService } from '../page-access/page-access.service';
import { User } from '@docmost/db/types/entity.types';
import { QueueName, QueueJob } from '../../../integrations/queue/constants';
import {
  ExpirationMode,
  ListVerificationsDto,
  PeriodUnit,
  SetupVerificationDto,
  VerificationType,
} from './dto/page-verification.dto';

export const VerificationStatus = {
  NONE: 'none',
  DRAFT: 'draft',
  IN_APPROVAL: 'in_approval',
  VERIFIED: 'verified',
  EXPIRING: 'expiring',
  EXPIRED: 'expired',
  OBSOLETE: 'obsolete',
} as const;

const EXPIRING_THRESHOLD_DAYS = 14;

@Injectable()
export class PageVerificationService {
  private readonly logger = new Logger(PageVerificationService.name);

  constructor(
    private readonly pageRepo: PageRepo,
    private readonly verificationRepo: PageVerificationRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly pageAccessService: PageAccessService,
    @InjectQueue(QueueName.NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue,
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

  private computeExpiresAt(opts: {
    mode?: string;
    periodAmount?: number;
    periodUnit?: string;
    fixedExpiresAt?: string | Date | null;
    from?: Date;
  }): Date | null {
    const from = opts.from ?? new Date();
    if (opts.mode === ExpirationMode.INDEFINITE) return null;
    if (opts.mode === ExpirationMode.FIXED) {
      return opts.fixedExpiresAt ? new Date(opts.fixedExpiresAt) : null;
    }
    if (opts.mode === ExpirationMode.PERIOD && opts.periodAmount) {
      const d = new Date(from);
      const n = opts.periodAmount;
      switch (opts.periodUnit) {
        case PeriodUnit.DAY:
          d.setDate(d.getDate() + n);
          break;
        case PeriodUnit.WEEK:
          d.setDate(d.getDate() + n * 7);
          break;
        case PeriodUnit.MONTH:
          d.setMonth(d.getMonth() + n);
          break;
        case PeriodUnit.YEAR:
          d.setFullYear(d.getFullYear() + n);
          break;
        default:
          return null;
      }
      return d;
    }
    return null;
  }

  /** Derive the effective status, factoring in expiry for verified records. */
  private deriveStatus(v: any): string {
    if (v.status === VerificationStatus.VERIFIED && v.expiresAt) {
      const now = Date.now();
      const expires = new Date(v.expiresAt).getTime();
      if (now >= expires) return VerificationStatus.EXPIRED;
      const threshold = expires - EXPIRING_THRESHOLD_DAYS * 86_400_000;
      if (now >= threshold) return VerificationStatus.EXPIRING;
    }
    return v.status ?? VerificationStatus.NONE;
  }

  async getInfo(pageId: string, user: User) {
    const page = await this.getPageOrThrow(pageId);
    await this.pageAccessService.validateCanView(page, user);

    const v = await this.verificationRepo.findByPageId(pageId, {
      includeVerifiers: true,
    });
    const canManage = await this.canManage(page, user);

    if (!v) {
      return {
        pageId,
        hasVerification: false,
        status: VerificationStatus.NONE,
        verifiers: [],
        permissions: {
          canManage,
          canVerify: false,
          canSubmitForApproval: false,
          canMarkObsolete: false,
        },
      };
    }

    const verifierIds = (v.verifiers ?? []).map((x: any) => x.id);
    const isVerifier = verifierIds.includes(user.id);
    const status = this.deriveStatus(v);
    const canVerify =
      isVerifier || (canManage && verifierIds.length === 0);

    return {
      id: v.id,
      pageId,
      hasVerification: true,
      type: v.type,
      status,
      mode: v.mode,
      periodAmount: v.periodAmount,
      periodUnit: v.periodUnit,
      verifiedAt: v.verifiedAt,
      verifiedById: v.verifiedById,
      expiresAt: v.expiresAt,
      requestedAt: v.requestedAt,
      requestedById: v.requestedById,
      rejectedAt: v.rejectedAt,
      rejectionComment: v.rejectionComment,
      verifiers: v.verifiers ?? [],
      permissions: {
        canManage,
        canVerify,
        canSubmitForApproval:
          canManage &&
          v.type === VerificationType.QMS &&
          [VerificationStatus.DRAFT].includes(status as any),
        canMarkObsolete:
          canManage &&
          [VerificationStatus.VERIFIED, VerificationStatus.EXPIRING, VerificationStatus.EXPIRED].includes(
            status as any,
          ),
      },
    };
  }

  private async assertCanManage(page: any, user: User) {
    if (!(await this.canManage(page, user))) {
      throw new ForbiddenException(
        'You do not have permission to manage verification for this page',
      );
    }
  }

  async setup(dto: SetupVerificationDto, user: User) {
    const page = await this.getPageOrThrow(dto.pageId);
    await this.assertCanManage(page, user);

    const type = dto.type ?? VerificationType.EXPIRING;
    const existing = await this.verificationRepo.findByPageId(dto.pageId);

    const baseValues = {
      type,
      mode: dto.mode ?? null,
      periodAmount: dto.periodAmount ?? null,
      periodUnit: dto.periodUnit ?? null,
      // For fixed mode we store the target date up front so it survives before verify.
      expiresAt:
        dto.mode === ExpirationMode.FIXED && dto.fixedExpiresAt
          ? new Date(dto.fixedExpiresAt)
          : existing?.expiresAt ?? null,
    };

    let verificationId: string;
    if (existing) {
      await this.verificationRepo.update(baseValues, existing.id);
      verificationId = existing.id;
    } else {
      const created = await this.verificationRepo.insert({
        pageId: page.id,
        workspaceId: page.workspaceId,
        spaceId: page.spaceId,
        creatorId: user.id,
        status: type === VerificationType.QMS ? VerificationStatus.DRAFT : null,
        ...baseValues,
      });
      verificationId = created.id;
    }

    if (dto.verifierIds) {
      await this.verificationRepo.replaceVerifiers(
        verificationId,
        dto.verifierIds,
        user.id,
        dto.primaryVerifierId,
      );
    }

    this.logAudit(
      existing
        ? AuditEvent.PAGE_VERIFICATION_UPDATED
        : AuditEvent.PAGE_VERIFICATION_CREATED,
      page,
    );

    return this.getInfo(dto.pageId, user);
  }

  async update(dto: SetupVerificationDto, user: User) {
    return this.setup(dto, user);
  }

  async remove(pageId: string, user: User) {
    const page = await this.getPageOrThrow(pageId);
    await this.assertCanManage(page, user);
    await this.verificationRepo.deleteByPageId(pageId);
    this.logAudit(AuditEvent.PAGE_VERIFICATION_REMOVED, page);
    return this.getInfo(pageId, user);
  }

  async verify(pageId: string, user: User) {
    const page = await this.getPageOrThrow(pageId);
    const v = await this.verificationRepo.findByPageId(pageId);
    if (!v) throw new NotFoundException('Page has no verification');

    const verifierIds = await this.verificationRepo.getVerifierUserIds(v.id);
    const canManage = await this.canManage(page, user);
    const isVerifier = verifierIds.includes(user.id);
    if (!isVerifier && !(canManage && verifierIds.length === 0)) {
      throw new ForbiddenException('Only assigned verifiers can verify');
    }

    const expiresAt = this.computeExpiresAt({
      mode: v.mode,
      periodAmount: v.periodAmount,
      periodUnit: v.periodUnit,
      fixedExpiresAt: v.expiresAt,
    });

    await this.verificationRepo.update(
      {
        status: VerificationStatus.VERIFIED,
        verifiedAt: new Date(),
        verifiedById: user.id,
        expiresAt,
        rejectedAt: null,
        rejectedById: null,
        rejectionComment: null,
      },
      v.id,
    );

    await this.enqueue(QueueJob.PAGE_VERIFIED_NOTIFICATION, {
      pageId,
      spaceId: page.spaceId,
      workspaceId: page.workspaceId,
      actorId: user.id,
      verifierIds,
    });
    this.logAudit(AuditEvent.PAGE_VERIFIED, page);

    return this.getInfo(pageId, user);
  }

  async submitForApproval(pageId: string, user: User) {
    const page = await this.getPageOrThrow(pageId);
    await this.assertCanManage(page, user);
    const v = await this.verificationRepo.findByPageId(pageId);
    if (!v) throw new NotFoundException('Page has no verification');
    if (v.type !== VerificationType.QMS) {
      throw new BadRequestException(
        'Approval workflow is only available for QMS verifications',
      );
    }

    const verifierIds = await this.verificationRepo.getVerifierUserIds(v.id);
    if (verifierIds.length === 0) {
      throw new BadRequestException('Assign at least one verifier first');
    }

    await this.verificationRepo.update(
      {
        status: VerificationStatus.IN_APPROVAL,
        requestedAt: new Date(),
        requestedById: user.id,
        rejectedAt: null,
        rejectedById: null,
        rejectionComment: null,
      },
      v.id,
    );

    await this.enqueue(QueueJob.PAGE_APPROVAL_REQUESTED_NOTIFICATION, {
      pageId,
      spaceId: page.spaceId,
      workspaceId: page.workspaceId,
      actorId: user.id,
      verifierIds,
    });
    this.logAudit(AuditEvent.PAGE_APPROVAL_REQUESTED, page);

    return this.getInfo(pageId, user);
  }

  async rejectApproval(pageId: string, user: User, comment?: string) {
    const page = await this.getPageOrThrow(pageId);
    const v = await this.verificationRepo.findByPageId(pageId);
    if (!v) throw new NotFoundException('Page has no verification');

    const verifierIds = await this.verificationRepo.getVerifierUserIds(v.id);
    if (!verifierIds.includes(user.id)) {
      throw new ForbiddenException('Only assigned verifiers can reject');
    }

    await this.verificationRepo.update(
      {
        status: VerificationStatus.DRAFT,
        rejectedAt: new Date(),
        rejectedById: user.id,
        rejectionComment: comment ?? null,
      },
      v.id,
    );

    if (v.requestedById) {
      await this.enqueue(QueueJob.PAGE_APPROVAL_REJECTED_NOTIFICATION, {
        pageId,
        spaceId: page.spaceId,
        workspaceId: page.workspaceId,
        actorId: user.id,
        requestedById: v.requestedById,
        comment,
      });
    }
    this.logAudit(AuditEvent.PAGE_APPROVAL_REJECTED, page);

    return this.getInfo(pageId, user);
  }

  async markObsolete(pageId: string, user: User) {
    const page = await this.getPageOrThrow(pageId);
    await this.assertCanManage(page, user);
    const v = await this.verificationRepo.findByPageId(pageId);
    if (!v) throw new NotFoundException('Page has no verification');

    await this.verificationRepo.update(
      { status: VerificationStatus.OBSOLETE },
      v.id,
    );
    this.logAudit(AuditEvent.PAGE_MARKED_OBSOLETE, page);
    return this.getInfo(pageId, user);
  }

  async list(dto: ListVerificationsDto, user: User) {
    // Restrict the overview to spaces the user is a member of.
    const userSpaceIds = await this.spaceMemberRepo.getUserSpaceIds(user.id);
    if (userSpaceIds.length === 0) {
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
    const spaceIds = dto.spaceIds?.length
      ? dto.spaceIds.filter((id) => userSpaceIds.includes(id))
      : userSpaceIds;

    const result = await this.verificationRepo.getWorkspaceVerificationsPaginated(
      user.workspaceId,
      dto,
      { spaceIds, type: dto.type },
    );

    // annotate each item with its derived status
    result.items = result.items.map((v: any) => ({
      ...v,
      status: this.deriveStatus(v),
    }));
    return result;
  }

  private async enqueue(job: string, payload: any) {
    try {
      await this.notificationQueue.add(job, payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to enqueue ${job}: ${message}`);
    }
  }
}
