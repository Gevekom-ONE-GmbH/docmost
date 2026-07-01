import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { InsertableAudit } from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { ExpressionBuilder } from 'kysely';
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

  async getWorkspaceAuditPaginated(
    workspaceId: string,
    pagination: PaginationOptions,
  ) {
    const query = this.db
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

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [{ expression: 'id', direction: 'desc' }],
      parseCursor: (c) => ({ id: c.id }),
    });
  }
}
