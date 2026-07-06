import { Injectable } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { sql } from 'kysely';
import { getPageTitle } from '../../../common/helpers';

export interface PageAuditSnapshot {
  pageId: string;
  title: string;
  slugId: string;
  spaceId: string;
  spaceName: string | null;
  parentPageId: string | null;
  path: string;
}

/**
 * Builds rich, self-contained audit metadata for a page (so it stays
 * meaningful even after the page row is hard-deleted). Used by every
 * page lifecycle audit entry (trash/delete/restore/move/purge).
 */
@Injectable()
export class PageAuditService {
  constructor(@InjectKysely() private readonly db: KyselyDB) {}

  /** Title, ids, space and breadcrumb path for a page. Null if not found. */
  async snapshot(pageId: string): Promise<PageAuditSnapshot | null> {
    const page = await this.db
      .selectFrom('pages')
      .leftJoin('spaces', 'spaces.id', 'pages.spaceId')
      .select([
        'pages.id as id',
        'pages.title as title',
        'pages.slugId as slugId',
        'pages.spaceId as spaceId',
        'pages.parentPageId as parentPageId',
        'spaces.name as spaceName',
      ])
      .where('pages.id', '=', pageId)
      .executeTakeFirst();

    if (!page) return null;

    // Ancestors incl. self, ordered root -> leaf, for a breadcrumb path.
    const ancestors = await this.db
      .withRecursive('anc', (d) =>
        d
          .selectFrom('pages')
          .select(['id', 'title', 'parentPageId', sql<number>`0`.as('depth')])
          .where('id', '=', pageId)
          .unionAll((e) =>
            e
              .selectFrom('pages as p')
              .innerJoin('anc', 'anc.parentPageId', 'p.id')
              .select([
                'p.id',
                'p.title',
                'p.parentPageId',
                sql<number>`anc.depth + 1`.as('depth'),
              ]),
          ),
      )
      .selectFrom('anc')
      .select(['title', 'depth'])
      .orderBy('depth', 'desc')
      .execute();

    return {
      pageId: page.id,
      title: getPageTitle(page.title),
      slugId: page.slugId,
      spaceId: page.spaceId,
      spaceName: page.spaceName ?? null,
      parentPageId: page.parentPageId ?? null,
      path: ancestors.map((a) => getPageTitle(a.title)).join(' / '),
    };
  }

  /** Descendant pages (excluding the page itself) — the cascade victims. */
  async descendants(
    pageId: string,
  ): Promise<{ count: number; pages: { id: string; title: string }[] }> {
    const rows = await this.db
      .withRecursive('d', (db) =>
        db
          .selectFrom('pages')
          .select(['id', 'title'])
          .where('id', '=', pageId)
          .unionAll((e) =>
            e
              .selectFrom('pages as p')
              .innerJoin('d', 'd.id', 'p.parentPageId')
              .select(['p.id', 'p.title']),
          ),
      )
      .selectFrom('d')
      .select(['id', 'title'])
      .execute();

    const pages = rows
      .filter((r) => r.id !== pageId)
      .map((r) => ({ id: r.id, title: getPageTitle(r.title) }));
    // cap the stored list to keep the audit payload bounded
    return { count: pages.length, pages: pages.slice(0, 100) };
  }
}
