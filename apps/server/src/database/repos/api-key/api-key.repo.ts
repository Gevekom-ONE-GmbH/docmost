import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  ApiKey,
  InsertableApiKey,
  UpdatableApiKey,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { ExpressionBuilder } from 'kysely';
import { DB } from '@docmost/db/types/db';
import { jsonObjectFrom } from 'kysely/helpers/postgres';

@Injectable()
export class ApiKeyRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  private baseFields: Array<keyof ApiKey> = [
    'id',
    'name',
    'creatorId',
    'workspaceId',
    'expiresAt',
    'lastUsedAt',
    'createdAt',
    'updatedAt',
    'deletedAt',
  ];

  withCreator(eb: ExpressionBuilder<DB, 'apiKeys'>) {
    return jsonObjectFrom(
      eb
        .selectFrom('users')
        .select(['users.id', 'users.name', 'users.email', 'users.avatarUrl'])
        .whereRef('users.id', '=', 'apiKeys.creatorId'),
    ).as('creator');
  }

  async findById(
    apiKeyId: string,
    workspaceId: string,
    opts?: { includeCreator?: boolean; trx?: KyselyTransaction },
  ): Promise<ApiKey> {
    const db = dbOrTx(this.db, opts?.trx);

    let query = db
      .selectFrom('apiKeys')
      .select(this.baseFields)
      .where('id', '=', apiKeyId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null);

    if (opts?.includeCreator) {
      query = query.select((eb) => this.withCreator(eb));
    }

    return query.executeTakeFirst();
  }

  async insert(insertable: InsertableApiKey): Promise<ApiKey> {
    return this.db
      .insertInto('apiKeys')
      .values(insertable)
      .returning(this.baseFields)
      .executeTakeFirst();
  }

  async update(
    updatable: UpdatableApiKey,
    apiKeyId: string,
    workspaceId: string,
  ): Promise<void> {
    await this.db
      .updateTable('apiKeys')
      .set({ ...updatable, updatedAt: new Date() })
      .where('id', '=', apiKeyId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .execute();
  }

  async updateLastUsedAt(apiKeyId: string): Promise<void> {
    await this.db
      .updateTable('apiKeys')
      .set({ lastUsedAt: new Date() })
      .where('id', '=', apiKeyId)
      .execute();
  }

  /** Soft-delete = revoke. The signed token can no longer be validated. */
  async revoke(apiKeyId: string, workspaceId: string): Promise<void> {
    await this.db
      .updateTable('apiKeys')
      .set({ deletedAt: new Date() })
      .where('id', '=', apiKeyId)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .execute();
  }

  async getWorkspaceApiKeysPaginated(
    workspaceId: string,
    pagination: PaginationOptions,
    opts?: { creatorId?: string },
  ) {
    let query = this.db
      .selectFrom('apiKeys')
      .select(this.baseFields)
      .select((eb) => this.withCreator(eb))
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null);

    if (opts?.creatorId) {
      query = query.where('creatorId', '=', opts.creatorId);
    }

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [
        { expression: 'createdAt', direction: 'desc' },
        { expression: 'id', direction: 'desc' },
      ],
      parseCursor: (cursor) => ({
        createdAt: new Date(cursor.createdAt),
        id: cursor.id,
      }),
    });
  }
}
