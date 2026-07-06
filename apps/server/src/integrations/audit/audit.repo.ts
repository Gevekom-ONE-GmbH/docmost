import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { InsertableAudit } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { ExpressionBuilder, sql } from 'kysely';
import { DB } from '@docmost/db/types/db';
import { jsonObjectFrom } from 'kysely/helpers/postgres';

@Injectable()
export class AuditRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  withActor(eb: ExpressionBuilder<DB, 'audit'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.email', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'audit.actorId'),
    ).as('actor');
  }

  async insert(data: InsertableAudit): Promise<void> {
    await this.db.insertInto('audit').values(data).execute();
  }

  private baseQuery(
    workspaceId: string,
    filters: {
      query?: string;
      event?: string;
      resourceType?: string;
      resourceId?: string;
    } = {},
  ) {
    const { query, event, resourceType, resourceId } = filters;
    let q = this.db
      .selectFrom('audit')
      .select([
        'id',
        'workspaceId',
        'actorId',
        'actorType',
        'event',
        'resourceType',
        'resourceId',
        'spaceId',
        'changes',
        'metadata',
        'ipAddress',
        'createdAt',
      ])
      .select((eb) => this.withActor(eb))
      .where('workspaceId', '=', workspaceId);

    const term = query?.trim();
    if (term) {
      const like = `%${term}%`;
      q = q.where((eb) =>
        eb.or([
          eb('event', 'ilike', like),
          eb('resourceType', 'ilike', like),
          eb(sql`host(audit.ip_address)`, 'ilike', like),
          eb(
            'actorId',
            'in',
            eb
              .selectFrom('users')
              .select('users.id')
              .where('users.name', 'ilike', like),
          ),
        ]),
      );
    }
    if (event) q = q.where('event', '=', event);
    if (resourceType) q = q.where('resourceType', '=', resourceType);
    if (resourceId) q = q.where('resourceId', '=', resourceId);
    return q;
  }

  async getWorkspaceAuditPaginated(
    workspaceId: string,
    pagination: PaginationOptions & {
      event?: string;
      resourceType?: string;
      resourceId?: string;
    },
  ) {
    return executeWithCursorPagination(
      this.baseQuery(workspaceId, {
        query: pagination.query,
        event: pagination.event,
        resourceType: pagination.resourceType,
        resourceId: pagination.resourceId,
      }),
      {
        perPage: pagination.limit,
        cursor: pagination.cursor,
        beforeCursor: pagination.beforeCursor,
        fields: [{ expression: 'id', direction: 'desc' }],
        parseCursor: (c) => ({ id: c.id }),
      },
    );
  }

  /** Fetch rows for CSV export (capped) applying the same filters. */
  async getWorkspaceAuditForExport(
    workspaceId: string,
    filters: {
      query?: string;
      event?: string;
      resourceType?: string;
      resourceId?: string;
    } = {},
    limit = 10000,
  ) {
    return this.baseQuery(workspaceId, filters)
      .orderBy('id', 'desc')
      .limit(limit)
      .execute();
  }
}
