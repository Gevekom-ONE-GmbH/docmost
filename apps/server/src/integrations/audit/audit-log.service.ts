import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import {
  AUDIT_CONTEXT_KEY,
  AuditContext,
} from '../../common/middlewares/audit-context.middleware';
import { AuditLogPayload, ActorType } from '../../common/events/audit-events';
import { AuditRepo } from './audit.repo';
import { IAuditService, AuditLogContext } from './audit.service';

/**
 * Real audit service (clean-room, non-EE): persists audit events emitted across
 * the app into the core `audit` table. Workspace / actor / ip are pulled from
 * the request-scoped CLS AuditContext when not passed explicitly.
 */
@Injectable()
export class AuditLogService implements IAuditService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    private readonly cls: ClsService,
    private readonly auditRepo: AuditRepo,
  ) {}

  private getContext(): AuditContext | undefined {
    return this.cls.get(AUDIT_CONTEXT_KEY);
  }

  log(payload: AuditLogPayload): void {
    const ctx = this.getContext();
    if (!ctx?.workspaceId) return;
    void this.persist(payload, {
      workspaceId: ctx.workspaceId,
      actorId: ctx.actorId ?? undefined,
      actorType: ctx.actorType ?? 'user',
      ipAddress: ctx.ipAddress ?? undefined,
    });
  }

  logWithContext(payload: AuditLogPayload, context: AuditLogContext): void {
    if (!context?.workspaceId) return;
    void this.persist(payload, context);
  }

  logBatchWithContext(
    payloads: AuditLogPayload[],
    context: AuditLogContext,
  ): void {
    if (!context?.workspaceId) return;
    for (const payload of payloads) {
      void this.persist(payload, context);
    }
  }

  setActorId(actorId: string): void {
    const ctx = this.getContext();
    if (ctx) {
      ctx.actorId = actorId;
      this.cls.set(AUDIT_CONTEXT_KEY, ctx);
    }
  }

  setActorType(actorType: ActorType): void {
    const ctx = this.getContext();
    if (ctx) {
      ctx.actorType = actorType;
      this.cls.set(AUDIT_CONTEXT_KEY, ctx);
    }
  }

  updateRetention(): void {
    // Retention pruning is not implemented in this build.
  }

  private async persist(payload: AuditLogPayload, context: AuditLogContext) {
    try {
      await this.auditRepo.insert({
        workspaceId: context.workspaceId,
        actorId: context.actorId ?? null,
        actorType: context.actorType ?? 'user',
        event: payload.event,
        resourceType: payload.resourceType,
        resourceId: payload.resourceId ?? null,
        spaceId: payload.spaceId ?? null,
        changes: payload.changes ?? null,
        metadata: payload.metadata ?? null,
        ipAddress: context.ipAddress ?? null,
      });
    } catch (err) {
      // Auditing must never break the originating request.
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to write audit log: ${message}`);
    }
  }
}
