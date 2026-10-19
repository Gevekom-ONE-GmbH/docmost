import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '../../types/kysely.types';
import {
  InsertableWebhook,
  UpdatableWebhook,
  Webhook,
} from '@docmost/db/types/entity.types';
import { PaginationOptions } from '@docmost/db/pagination/pagination-options';
import { executeWithCursorPagination } from '@docmost/db/pagination/cursor-pagination';

@Injectable()
export class WebhookRepo {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  async findById(id: string, workspaceId: string): Promise<Webhook> {
    return this.db
      .selectFrom('webhooks')
      .selectAll()
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .executeTakeFirst();
  }

  async findActiveByWorkspace(workspaceId: string): Promise<Webhook[]> {
    return this.db
      .selectFrom('webhooks')
      .selectAll()
      .where('workspaceId', '=', workspaceId)
      .where('isActive', '=', true)
      .where('deletedAt', 'is', null)
      .execute();
  }

  async insert(data: InsertableWebhook): Promise<Webhook> {
    return this.db
      .insertInto('webhooks')
      .values(data)
      .returningAll()
      .executeTakeFirst();
  }

  async update(
    data: UpdatableWebhook,
    id: string,
    workspaceId: string,
  ): Promise<void> {
    await this.db
      .updateTable('webhooks')
      .set({ ...data, updatedAt: new Date() })
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .execute();
  }

  async softDelete(id: string, workspaceId: string): Promise<void> {
    await this.db
      .updateTable('webhooks')
      .set({ deletedAt: new Date() })
      .where('id', '=', id)
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null)
      .execute();
  }

  async touchLastTriggered(id: string): Promise<void> {
    await this.db
      .updateTable('webhooks')
      .set({ lastTriggeredAt: new Date() })
      .where('id', '=', id)
      .execute();
  }

  async listByWorkspace(workspaceId: string, pagination: PaginationOptions) {
    const query = this.db
      .selectFrom('webhooks')
      .select([
        'id',
        'name',
        'url',
        'secret',
        'events',
        'isActive',
        'workspaceId',
        'creatorId',
        'lastTriggeredAt',
        'createdAt',
        'updatedAt',
      ])
      .where('workspaceId', '=', workspaceId)
      .where('deletedAt', 'is', null);

    return executeWithCursorPagination(query, {
      perPage: pagination.limit,
      cursor: pagination.cursor,
      beforeCursor: pagination.beforeCursor,
      fields: [{ expression: 'id', direction: 'desc' }],
      parseCursor: (c) => ({ id: c.id }),
    });
  }
}
