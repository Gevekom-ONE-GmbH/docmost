import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB, KyselyTransaction } from '../../types/kysely.types';
import { dbOrTx } from '../../utils';
import {
  InsertablePageVerification,
  PageVerification,
  UpdatablePageVerification,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';
import { ExpressionBuilder } from 'kysely';
import { DB } from '@docmost/db/types/db';
import { jsonArrayFrom, jsonObjectFrom } from 'kysely/helpers/postgres';

export interface VerificationListFilters {
  spaceIds?: string[];
  type?: string;
}

@Injectable()
export class PageVerificationRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  withVerifiers(eb: ExpressionBuilder<DB, 'pageVerifications'>) {
    return jsonArrayFrom(
      eb
        .selectFrom('pageVerifiers')
        .innerJoin('users', 'users.id', 'pageVerifiers.userId')
        .select([
          'pageVerifiers.userId as id',
          'users.name',
          'users.email',
          'users.avatarUrl',
          'pageVerifiers.isPrimary',
        ])
        .whereRef(
          'pageVerifiers.pageVerificationId',
          '=',
          'pageVerifications.id',
        ),
    ).as('verifiers');
  }

  async findByPageId(
    pageId: string,
    opts?: { includeVerifiers?: boolean; trx?: KyselyTransaction },
  ): Promise<any> {
    const db = dbOrTx(this.db, opts?.trx);
    let query = db
      .selectFrom('pageVerifications')
      .selectAll('pageVerifications')
      .where('pageId', '=', pageId);

    if (opts?.includeVerifiers) {
      query = query.select((eb) => this.withVerifiers(eb));
    }
    return query.executeTakeFirst();
  }

  async insert(data: InsertablePageVerification): Promise<PageVerification> {
    return this.db
      .insertInto('pageVerifications')
      .values(data)
      .returningAll()
      .executeTakeFirst();
  }

  async update(
    data: UpdatablePageVerification,
    id: string,
    trx?: KyselyTransaction,
  ): Promise<void> {
    const db = dbOrTx(this.db, trx);
    await db
      .updateTable('pageVerifications')
      .set({ ...data, updatedAt: new Date() })
      .where('id', '=', id)
      .execute();
  }

  async deleteByPageId(pageId: string): Promise<void> {
    await this.db
      .deleteFrom('pageVerifications')
      .where('pageId', '=', pageId)
      .execute();
  }

  async getVerifierUserIds(verificationId: string): Promise<string[]> {
    const rows = await this.db
      .selectFrom('pageVerifiers')
      .select('userId')
      .where('pageVerificationId', '=', verificationId)
      .execute();
    return rows.map((r) => r.userId);
  }

  /** Replace the whole verifier set for a verification. */
  async replaceVerifiers(
    verificationId: string,
    userIds: string[],
    addedById: string,
    primaryId?: string,
  ): Promise<void> {
    await this.db
      .deleteFrom('pageVerifiers')
      .where('pageVerificationId', '=', verificationId)
      .execute();
    if (userIds.length === 0) return;
    const rows = userIds.map((userId) => ({
      pageVerificationId: verificationId,
      userId,
      addedById,
      isPrimary: primaryId ? userId === primaryId : false,
    }));
    await this.db.insertInto('pageVerifiers').values(rows).execute();
  }

  async getWorkspaceVerificationsPaginated(
    workspaceId: string,
    pagination: PaginationOptions,
    filters?: VerificationListFilters,
  ) {
    let query = this.db
      .selectFrom('pageVerifications')
      .selectAll('pageVerifications')
      .select((eb) => this.withVerifiers(eb))
      .select((eb) =>
        jsonObjectFrom(
          eb
            .selectFrom('pages')
            .select(['pages.id', 'pages.title', 'pages.slugId'])
            .whereRef('pages.id', '=', 'pageVerifications.pageId'),
        ).as('page'),
      )
      .select((eb) =>
        jsonObjectFrom(
          eb
            .selectFrom('spaces')
            .select(['spaces.id', 'spaces.name', 'spaces.slug'])
            .whereRef('spaces.id', '=', 'pageVerifications.spaceId'),
        ).as('space'),
      )
      .where('workspaceId', '=', workspaceId);

    if (filters?.spaceIds?.length) {
      query = query.where('spaceId', 'in', filters.spaceIds);
    }
    if (filters?.type) {
      query = query.where('type', '=', filters.type);
    }

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [{ expression: 'id', direction: 'desc' }],
      parseCursor: (c) => ({ id: c.id }),
    });
  }
}
