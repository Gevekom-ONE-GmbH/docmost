import * as http from 'http';
import { AddressInfo } from 'net';
import { McpContext, McpService } from './mcp.service';

const user = { id: 'user-1', workspaceId: 'workspace-1' } as any;
const workspace = { id: 'workspace-1' } as any;

function buildService() {
  const page = {
    id: 'page-1',
    slugId: 'abc123',
    title: 'Roadmap',
    spaceId: 'space-1',
    space: { name: 'General' },
    creator: { id: 'user-2', name: 'Ada', email: 'ada@example.com' },
    lastUpdatedBy: null,
    content: { type: 'doc', content: [] },
    deletedAt: null,
  };
  const pageRepo = { findById: jest.fn().mockResolvedValue(page) };
  const pageAccessService = { validateCanView: jest.fn() };
  const service = new McpService(
    {} as any,
    {} as any,
    pageRepo as any,
    {} as any,
    pageAccessService as any,
    {} as any,
    { log: jest.fn() } as any,
    {} as any,
  );
  return { service, pageRepo, pageAccessService };
}

async function startServer(service: McpService, ctx: McpContext) {
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      void service.handle(req, res, raw ? JSON.parse(raw) : undefined, ctx);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${port}/mcp` };
}

function rpc(url: string, method: string, params: unknown, id = 1) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-06-18',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
}

const MODERN_META = {
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientInfo': { name: 'jest', version: '1.0.0' },
  'io.modelcontextprotocol/clientCapabilities': {},
};

function modernRpc(
  url: string,
  method: string,
  params: { name?: string; [key: string]: unknown } = {},
) {
  return fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2026-07-28',
      'mcp-method': method,
      ...(params.name ? { 'mcp-name': params.name } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params: { ...params, _meta: MODERN_META },
    }),
  });
}

describe('McpService (stateless HTTP)', () => {
  let server: http.Server;
  let url: string;
  let deps: ReturnType<typeof buildService>;

  async function start(writeEnabled: boolean) {
    deps = buildService();
    ({ server, url } = await startServer(deps.service, {
      user,
      workspace,
      writeEnabled,
    }));
  }

  afterEach(async () => {
    await new Promise((resolve) => server?.close(resolve));
  });

  it('answers initialize with server info and instructions', async () => {
    await start(true);
    const res = await rpc(url, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'jest', version: '1.0.0' },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.serverInfo.name).toBe('docmost');
    expect(body.result.instructions).toContain('get_users');
  });

  it('lists read and write tools', async () => {
    await start(true);
    const body = await (await rpc(url, 'tools/list', {})).json();
    const names = body.result.tools.map((t: any) => t.name).sort();

    expect(names).toEqual([
      'create_page',
      'get_page',
      'get_users',
      'list_spaces',
      'search_pages',
      'update_page',
    ]);
  });

  it('hides write tools when writes are disabled', async () => {
    await start(false);
    const body = await (await rpc(url, 'tools/list', {})).json();
    const names = body.result.tools.map((t: any) => t.name);

    expect(names).not.toContain('create_page');
    expect(names).not.toContain('update_page');
  });

  it('calls get_page with the user permission check', async () => {
    await start(true);
    const body = await (
      await rpc(url, 'tools/call', {
        name: 'get_page',
        arguments: { pageId: 'page-1' },
      })
    ).json();

    expect(deps.pageAccessService.validateCanView).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'page-1' }),
      user,
    );
    const page = JSON.parse(body.result.content[0].text);
    expect(page).toMatchObject({
      id: 'page-1',
      title: 'Roadmap',
      spaceName: 'General',
      creator: { name: 'Ada' },
    });
  });

  it('serves 2026-07-28 clients with JSON responses', async () => {
    await start(true);
    const discover = await modernRpc(url, 'server/discover');
    expect(discover.headers.get('content-type')).toContain('application/json');
    const discovered = await discover.json();
    expect(discovered.result.supportedVersions).toContain('2026-07-28');

    const body = await (
      await modernRpc(url, 'tools/call', {
        name: 'get_page',
        arguments: { pageId: 'page-1' },
      })
    ).json();
    expect(JSON.parse(body.result.content[0].text).id).toBe('page-1');
    expect(deps.pageAccessService.validateCanView).toHaveBeenCalled();
  });

  it('rejects invalid tool arguments', async () => {
    await start(true);
    const body = await (
      await rpc(url, 'tools/call', { name: 'get_page', arguments: {} })
    ).json();

    expect(body.result?.isError ?? !!body.error).toBe(true);
    expect(deps.pageRepo.findById).not.toHaveBeenCalled();
  });
});
