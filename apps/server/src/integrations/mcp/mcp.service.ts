import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import {
  createMcpHandler,
  isLegacyRequest,
  McpServer,
  WebStandardStreamableHTTPServerTransport,
} from '@modelcontextprotocol/server';
import type { IncomingMessage, ServerResponse } from 'http';
import { Readable } from 'stream';
import { z } from 'zod';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { SearchService } from '../../core/search/search.service';
import { PageService } from '../../core/page/services/page.service';
import { PageRepo } from '@docmost/db/repos/page/page.repo';
import { SpaceMemberRepo } from '@docmost/db/repos/space/space-member.repo';
import { PageAccessService } from '../../core/page/page-access/page-access.service';
import { User, Workspace } from '@docmost/db/types/entity.types';
import SpaceAbilityFactory from '../../core/casl/abilities/space-ability.factory';
import {
  SpaceCaslAction,
  SpaceCaslSubject,
} from '../../core/casl/interfaces/space-ability.type';
import { AUDIT_SERVICE, IAuditService } from '../audit/audit.service';
import { AuditEvent, AuditResource } from '../../common/events/audit-events';
import { getPageTitle } from '../../common/helpers';

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
    private readonly spaceAbility: SpaceAbilityFactory,
    @Inject(AUDIT_SERVICE) private readonly auditService: IAuditService,
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

    const request = this.toWebRequest(req, body);
    const legacy = await isLegacyRequest(request, body);
    const { response, close } = legacy
      ? await this.handleLegacy(request, body, ctx)
      : await this.handleModern(request, body, ctx);
    try {
      await this.sendWebResponse(response, res);
    } finally {
      await close();
    }
  }

  /**
   * 2025-era clients (no per-request envelope): stateless streamable HTTP with
   * plain JSON responses, as before the SDK v2 migration. The SDK's own legacy
   * fallback would always answer with an SSE stream.
   */
  private async handleLegacy(request: Request, body: unknown, ctx: McpContext) {
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const server = this.buildServer(ctx);
    await server.connect(transport);
    const response = await transport.handleRequest(request, {
      parsedBody: body,
    });
    return { response, close: () => server.close() };
  }

  /** 2026-07-28 clients: per-request protocol, a fresh server per request. */
  private async handleModern(request: Request, body: unknown, ctx: McpContext) {
    const handler = createMcpHandler(() => this.buildServer(ctx), {
      legacy: 'reject',
      // 'auto' answers with plain JSON unless a tool emits mid-call
      // notifications (ours don't); 'json' would log a warning per request.
      responseMode: 'auto',
      onerror: (err) =>
        this.logger.debug(`MCP request rejected: ${err.message}`),
    });
    const response = await handler.fetch(request, { parsedBody: body });
    return { response, close: () => handler.close() };
  }

  private toWebRequest(req: IncomingMessage, body: unknown): Request {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
    const url = new URL(
      req.url ?? '/mcp',
      `http://${req.headers.host ?? 'localhost'}`,
    );
    return new Request(url, {
      method: req.method,
      headers,
      body: req.method === 'POST' ? JSON.stringify(body ?? null) : undefined,
    });
  }

  private async sendWebResponse(response: Response, res: ServerResponse) {
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (!response.body) {
      res.end();
      return;
    }
    await new Promise<void>((resolve, reject) => {
      Readable.fromWeb(response.body as any)
        .on('error', reject)
        .pipe(res)
        .on('finish', resolve)
        .on('close', resolve)
        .on('error', reject);
    });
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

  private async assertCanCreatePage(
    user: User,
    spaceId: string,
    parentPageId?: string,
  ) {
    if (parentPageId) {
      const parentPage = await this.pageRepo.findById(parentPageId);
      if (
        !parentPage ||
        parentPage.deletedAt ||
        parentPage.spaceId !== spaceId
      ) {
        throw new ForbiddenException('Parent page not found');
      }
      await this.pageAccessService.validateCanEdit(parentPage, user);
      return;
    }
    const ability = await this.spaceAbility.createForUser(user, spaceId);
    if (ability.cannot(SpaceCaslAction.Create, SpaceCaslSubject.Page)) {
      throw new ForbiddenException();
    }
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
  buildServer(ctx: McpContext): McpServer {
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
        inputSchema: z.object({
          query: z.string().describe('Search text'),
          spaceId: z
            .string()
            .optional()
            .describe(
              'Restrict to a space id (ignored when the session is space-scoped)',
            ),
          limit: z.number().int().min(1).max(50).optional(),
        }),
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
        inputSchema: z.object({ pageId: z.string() }),
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
        inputSchema: z.object({
          userIds: z
            .array(z.string())
            .min(1)
            .max(100)
            .describe('User UUIDs to resolve'),
        }),
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
        description:
          'List the spaces the user has access to in this workspace.',
        inputSchema: z.object({}),
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
          inputSchema: z.object({
            spaceId: z
              .string()
              .optional()
              .describe(
                'Target space id (optional when the session is space-scoped)',
              ),
            title: z.string(),
            content: z.string().describe('Markdown content'),
            parentPageId: z.string().optional(),
          }),
        },
        async ({ spaceId, title, content, parentPageId }) => {
          const targetSpaceId = ctx.spaceId ?? spaceId;
          if (!targetSpaceId) {
            return this.error('spaceId is required');
          }
          // Same permission rules as POST /api/pages/create.
          try {
            await this.assertCanCreatePage(user, targetSpaceId, parentPageId);
          } catch (err) {
            if (err instanceof ForbiddenException) {
              return this.error(
                'You do not have permission to create pages here',
              );
            }
            throw err;
          }
          const page = await this.pageService.create(user.id, workspace.id, {
            spaceId: targetSpaceId,
            title,
            content,
            format: 'markdown',
            parentPageId,
          } as any);
          this.auditService.log({
            event: AuditEvent.PAGE_CREATED,
            resourceType: AuditResource.PAGE,
            resourceId: page.id,
            spaceId: page.spaceId,
            changes: {
              after: { title: getPageTitle(page.title), spaceId: page.spaceId },
            },
            metadata: { source: 'mcp' },
          });
          return this.text({ id: page.id, slugId: page.slugId });
        },
      );

      server.registerTool(
        'update_page',
        {
          description:
            'Update a page with Markdown content. operation: replace (default), append or prepend.',
          inputSchema: z.object({
            pageId: z.string(),
            content: z.string().describe('Markdown content'),
            operation: z.enum(['replace', 'append', 'prepend']).optional(),
          }),
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
