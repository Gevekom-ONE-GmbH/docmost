import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { AuditRepo } from './audit.repo';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { AuthWorkspace } from '../../common/decorators/auth-workspace.decorator';
import { User, Workspace } from '@docmost/db/types/entity.types';
import { UserRole } from '../../common/helpers/types/permission';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  // Escape for CSV: wrap in quotes, double any internal quotes.
  return `"${s.replace(/"/g, '""')}"`;
}

@UseGuards(JwtAuthGuard)
@Controller()
export class AuditController {
  constructor(private readonly auditRepo: AuditRepo) {}

  private assertAdmin(user: User) {
    if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException();
    }
  }

  @HttpCode(HttpStatus.OK)
  @Post('audit')
  async list(
    @Body() pagination: PaginationOptions,
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
  ) {
    this.assertAdmin(user);
    return this.auditRepo.getWorkspaceAuditPaginated(workspace.id, pagination);
  }

  @HttpCode(HttpStatus.OK)
  @Post('audit/export')
  async exportCsv(
    @Body() body: { query?: string },
    @AuthUser() user: User,
    @AuthWorkspace() workspace: Workspace,
    @Res() res: FastifyReply,
  ) {
    this.assertAdmin(user);

    const rows = await this.auditRepo.getWorkspaceAuditForExport(
      workspace.id,
      body?.query,
    );

    const header = [
      'Date',
      'Event',
      'Resource Type',
      'Resource ID',
      'Actor',
      'Actor ID',
      'IP Address',
      'Space ID',
    ];
    const lines = [header.map(csvCell).join(',')];
    for (const r of rows as any[]) {
      lines.push(
        [
          r.createdAt instanceof Date
            ? r.createdAt.toISOString()
            : r.createdAt,
          r.event,
          r.resourceType,
          r.resourceId,
          r.actor?.name,
          r.actorId,
          r.ipAddress,
          r.spaceId,
        ]
          .map(csvCell)
          .join(','),
      );
    }
    // Prepend BOM so Excel opens UTF-8 correctly.
    const csv = '﻿' + lines.join('\r\n');

    res.headers({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="audit-log.csv"',
    });
    res.send(csv);
  }
}
