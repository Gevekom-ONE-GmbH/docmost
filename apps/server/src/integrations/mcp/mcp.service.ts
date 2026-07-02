import { Injectable, Logger } from '@nestjs/common';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { randomUUID } from 'crypto';
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
}

const packageJson = require('../../../package.json');

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
  // Active MCP sessions (single-instance, in-memory).
  private readonly transports = new Map<string, any>();
  private readonly owners = new Map<string, string>();

  private isInitialize(body: any): boolean {
    const has = (m: any) => m && m.method === 'initialize';
    return Array.isArray(body) ? body.some(has) : has(body);
  }

  /** Handle an MCP POST (JSON-RPC), managing the session lifecycle. */
  async handlePost(
    req: IncomingMessage,
    res: ServerResponse,
    body: any,
    ctx: McpContext,
  ) {
    const { StreamableHTTPServerTransport } = await import(
      '@modelcontextprotocol/sdk/server/streamableHttp.js'
    );
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    let transport: any;
    if (sessionId && this.transports.has(sessionId)) {
      if (this.owners.get(sessionId) !== ctx.user.id) {
        return this.reject(res, 403, 'Session belongs to another user');
      }
      transport = this.transports.get(sessionId);
    } else if (!sessionId && this.isInitialize(body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (id: string) => {
          this.transports.set(id, transport);
          this.owners.set(id, ctx.user.id);
        },
      });
      transport.onclose = () => {
        const id = transport.sessionId;
        if (id) {
          this.transports.delete(id);
          this.owners.delete(id);
        }
      };
      const server = await this.buildServer(ctx);
      await server.connect(transport);
    } else {
      return this.reject(
        res,
        400,
        'No valid session; send an initialize request first',
      );
    }

    await transport.handleRequest(req, res, body);
  }

  /** Handle GET (SSE) / DELETE for an existing session. */
  async handleSessionRequest(
    req: IncomingMessage,
    res: ServerResponse,
    ctx: McpContext,
  ) {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (
      !sessionId ||
      !this.transports.has(sessionId) ||
      this.owners.get(sessionId) !== ctx.user.id
    ) {
      return this.reject(res, 400, 'Invalid or missing session id');
    }
    await this.transports.get(sessionId).handleRequest(req, res);
  }

  private reject(res: ServerResponse, status: number, message: string) {
    res.statusCode = status;
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32000, message },
        id: null,
      }),
    );
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
    return { content: [{ type: 'text' as const, text: message }], isError: true };
  }

  /** Build a fresh MCP server whose tools are scoped to the authenticated user. */
  async buildServer(ctx: McpContext): Promise<McpServer> {
    const { McpServer } = await import(
      '@modelcontextprotocol/sdk/server/mcp.js'
    );
    const { user, workspace } = ctx;

    const server = new McpServer({
      name: 'docmost',
      version: packageJson.version,
    });

    server.registerTool(
      'search_pages',
      {
        description:
          'Full-text search for pages in the workspace. Only pages the user can access are returned.',
        inputSchema: {
          query: z.string().describe('Search text'),
          spaceId: z.string().optional().describe('Restrict to a space id'),
          limit: z.number().int().min(1).max(50).optional(),
        },
      },
      async ({ query, spaceId, limit }) => {
        const res = await this.searchService.searchPage(
          { query, spaceId, limit } as any,
          { userId: user.id, workspaceId: workspace.id },
        );
        return this.text(res.items);
      },
    );

    server.registerTool(
      'get_page',
      {
        description: 'Fetch a single page (title, ids and content) by its id.',
        inputSchema: { pageId: z.string() },
      },
      async ({ pageId }) => {
        const page = await this.pageRepo.findById(pageId, {
          includeContent: true,
          includeSpace: true,
        });
        if (!page || page.deletedAt) return this.error('Page not found');
        await this.pageAccessService.validateCanView(page, user);
        return this.text({
          id: page.id,
          slugId: page.slugId,
          title: page.title,
          spaceId: page.spaceId,
          content: page.content,
        });
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
          .where(
            'id',
            'in',
            this.spaceMemberRepo.getUserSpaceIdsQuery(user.id),
          )
          .execute();
        return this.text(spaces);
      },
    );

    if (ctx.writeEnabled) {
      server.registerTool(
        'create_page',
        {
          description:
            'Create a new page in a space from Markdown content. Returns the new page id.',
          inputSchema: {
            spaceId: z.string(),
            title: z.string(),
            content: z.string().describe('Markdown content'),
            parentPageId: z.string().optional(),
          },
        },
        async ({ spaceId, title, content, parentPageId }) => {
          const page = await this.pageService.create(user.id, workspace.id, {
            spaceId,
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
