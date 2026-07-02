import { Injectable, Logger } from '@nestjs/common';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { IncomingMessage, ServerResponse } from 'http';
import { z } from 'zod';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { SearchService } from '../../core/search/search.service';
import { PageService } from '../../core/page/services/page.service';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PageAccessService } from '../../core/page/page-access/page-access.service';
import { User, Workspace } from '@docmost/db/types/entity.types';

export interface McpContext {
  user: User;
  workspace: Workspace;
  writeEnabled: boolean;
  /** Raw ?space= query value (space id or slug), if provided. */
  spaceParam?: string;
  /** Resolved during handle() when spaceParam is set + accessible. */
  spaceId?: string;
  spaceName?: string;
}

const packageJson = require('../../../package.json');
const UUID_RE = /^[0-9a-fA-F-]{36}$/;

@Injectable()
export class McpService {
  constructor(
    private readonly searchService: SearchService,
    private readonly pageService: PageService,
    private readonly pageRepo: PageRepo,
    private readonly spaceMemberRepo: SpaceMemberRepo,
    private readonly pageAccessService: PageAccessService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  private readonly logger = new Logger(McpService.name);

  /**
   * Stateless MCP handling: a fresh McpServer + transport per request, no
   * session store. Works behind any load balancer / across instances without
   * session affinity, since no state is kept between requests.
   */
  async handle(
    req: IncomingMessage,
    res: ServerResponse,
    body: any,
    ctx: McpContext,
  ) {
    // Optional space scoping via ?space=<id|slug>.
    if (ctx.spaceParam) {
      const space = await this.resolveSpace(
        ctx.spaceParam,
        ctx.user,
        ctx.workspace,
      );
      if (!space) {
        res.statusCode = 400;
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: `Unknown or inaccessible space '${ctx.spaceParam}'`,
            },
            id: null,
          }),
        );
        return;
      }
      ctx.spaceId = space.id;
      ctx.spaceName = space.name;
    }

    const { StreamableHTTPServerTransport } = await import(
      '@modelcontextprotocol/sdk/server/streamableHttp.js'
    );
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const server = await this.buildServer(ctx);
    res.on('close', () => {
      try {
        void transport.close();
        void server.close();
      } catch {
        // ignore
      }
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  }

  private async resolveSpace(param: string, user: User, workspace: Workspace) {
    const isUuid = UUID_RE.test(param);
    return this.db
      .selectFrom('spaces')
      .select(['id', 'name', 'slug'])
      .where('workspaceId', '=', workspace.id)
      .where('deletedAt', 'is', null)
      .where('id', 'in', this.spaceMemberRepo.getUserSpaceIdsQuery(user.id))
      .where((eb) =>
        eb.or([
          eb('slug', '=', param),
          ...(isUuid ? [eb('id', '=', param)] : []),
        ]),
      )
      .executeTakeFirst();
  }

  private text(data: unknown) {
    return {
      content: [
        {
          type: 'text' as const,
          text: typeof data === 'string' ? data : JSON.stringify(data),
        },
      ],
    };
  }

  private error(message: string) {
    return {
      content: [{ type: 'text' as const, text: message }],
      isError: true,
    };
  }

  /** Build a fresh MCP server whose tools are scoped to the authenticated user. */
  async buildServer(ctx: McpContext): Promise<McpServer> {
    const { McpServer } = await import(
      '@modelcontextprotocol/sdk/server/mcp.js'
    );
    const { user, workspace } = ctx;
    const scopeNote = ctx.spaceId
      ? ` This session is scoped to the "${ctx.spaceName}" space.`
      : '';

    const server = new McpServer(
      { name: 'docmost', version: packageJson.version },
      {
        instructions: ctx.spaceId
          ? `Docmost wiki access, scoped to the "${ctx.spaceName}" space (id ${ctx.spaceId}). Page authors and other user ids can be resolved to names with the get_users tool.`
          : `Docmost wiki access. Page authors and other user ids can be resolved to names with the get_users tool.`,
      },
    );

    server.registerTool(
      'search_pages',
      {
        description:
          'Full-text search for pages. Only pages the user can access are returned.' +
          scopeNote,
        inputSchema: {
          query: z.string().describe('Search text'),
          spaceId: z
            .string()
            .optional()
            .describe('Restrict to a space id (ignored when the session is space-scoped)'),
          limit: z.number().int().min(1).max(50).optional(),
        },
      },
      async ({ query, spaceId, limit }) => {
        const res = await this.searchService.searchPage(
          { query, spaceId: ctx.spaceId ?? spaceId, limit } as any,
          { userId: user.id, workspaceId: workspace.id },
        );
        return this.text(res.items);
      },
    );

    server.registerTool(
      'get_page',
      {
        description:
          'Fetch a single page (title, content, creator and last editor) by its id.',
        inputSchema: { pageId: z.string() },
      },
      async ({ pageId }) => {
        const page = await this.pageRepo.findById(pageId, {
          includeContent: true,
          includeSpace: true,
          includeCreator: true,
          includeLastUpdatedBy: true,
        });
        if (!page || page.deletedAt) return this.error('Page not found');
        if (ctx.spaceId && page.spaceId !== ctx.spaceId) {
          return this.error('Page is not in the active space');
        }
        await this.pageAccessService.validateCanView(page, user);
        const asUser = (u: any) =>
          u ? { id: u.id, name: u.name, email: u.email } : null;
        return this.text({
          id: page.id,
          slugId: page.slugId,
          title: page.title,
          spaceId: page.spaceId,
          spaceName: (page as any).space?.name,
          creator: asUser((page as any).creator),
          lastUpdatedBy: asUser((page as any).lastUpdatedBy),
          createdAt: page.createdAt,
          updatedAt: page.updatedAt,
          content: page.content,
        });
      },
    );

    server.registerTool(
      'get_users',
      {
        description:
          'Resolve user ids (e.g. a page creator/author or last-editor id) to their names and emails.',
        inputSchema: {
          userIds: z
            .array(z.string())
            .min(1)
            .max(100)
            .describe('User UUIDs to resolve'),
        },
      },
      async ({ userIds }) => {
        const users = await this.db
          .selectFrom('users')
          .select(['id', 'name', 'email', 'avatarUrl'])
          .where('workspaceId', '=', workspace.id)
          .where('id', 'in', userIds)
          .execute();
        return this.text(users);
      },
    );

    server.registerTool(
      'list_spaces',
      {
        description: 'List the spaces the user has access to in this workspace.',
        inputSchema: {},
      },
      async () => {
        const spaces = await this.db
          .selectFrom('spaces')
          .select(['id', 'name', 'slug', 'description'])
          .where('workspaceId', '=', workspace.id)
          .where('deletedAt', 'is', null)
          .where('id', 'in', this.spaceMemberRepo.getUserSpaceIdsQuery(user.id))
          .execute();
        return this.text(spaces);
      },
    );

    if (ctx.writeEnabled) {
      server.registerTool(
        'create_page',
        {
          description:
            'Create a new page from Markdown content. Returns the new page id.' +
            (ctx.spaceId ? ' spaceId defaults to the active space.' : ''),
          inputSchema: {
            spaceId: z
              .string()
              .optional()
              .describe('Target space id (optional when the session is space-scoped)'),
            title: z.string(),
            content: z.string().describe('Markdown content'),
            parentPageId: z.string().optional(),
          },
        },
        async ({ spaceId, title, content, parentPageId }) => {
          const targetSpaceId = ctx.spaceId ?? spaceId;
          if (!targetSpaceId) {
            return this.error('spaceId is required');
          }
          const page = await this.pageService.create(user.id, workspace.id, {
            spaceId: targetSpaceId,
            title,
            content,
            format: 'markdown',
            parentPageId,
          } as any);
          return this.text({ id: page.id, slugId: page.slugId });
        },
      );

      server.registerTool(
        'update_page',
        {
          description:
            'Update a page with Markdown content. operation: replace (default), append or prepend.',
          inputSchema: {
            pageId: z.string(),
            content: z.string().describe('Markdown content'),
            operation: z.enum(['replace', 'append', 'prepend']).optional(),
          },
        },
        async ({ pageId, content, operation }) => {
          const page = await this.pageRepo.findById(pageId);
          if (!page || page.deletedAt) return this.error('Page not found');
          if (ctx.spaceId && page.spaceId !== ctx.spaceId) {
            return this.error('Page is not in the active space');
          }
          await this.pageAccessService.validateCanEdit(page, user);
          await this.pageService.update(
            page,
            {
              pageId,
              content,
              format: 'markdown',
              operation: operation ?? 'replace',
            } as any,
            user,
          );
          return this.text('ok');
        },
      );
    }

    return server;
  }
}
