import { Global, Module } from '@nestjs/common';
import { AUDIT_SERVICE } from './audit.service';
import { AuditLogService } from './audit-log.service';
import { AuditRepo } from './audit.repo';
import { AuditController } from './audit.controller';

/**
 * Real (clean-room, non-EE) audit module. Replaces NoopAuditModule so that
 * audit events emitted across the app are persisted to the `audit` table and
 * exposed via POST /audit for workspace admins.
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [
    AuditRepo,
    AuditLogService,
    { provide: AUDIT_SERVICE, useExisting: AuditLogService },
  ],
  exports: [AUDIT_SERVICE],
})
export class AuditLogModule {}
