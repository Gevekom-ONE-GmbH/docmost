import {
  CompiledQuery,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
import { WorkspaceHostBackfillService } from './workspace-host-backfill.service';
import { WorkspaceResolverService } from './workspace-resolver.service';

function createFakeDb(affectedRows: number) {
  const queries: CompiledQuery[] = [];
  const connection = {
    executeQuery: async (compiled: CompiledQuery) => {
      queries.push(compiled);
      return { rows: [], numAffectedRows: BigInt(affectedRows) };
    },
    streamQuery: async function* () {},
  };
  const db = new Kysely<any>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => ({
        init: async () => {},
        acquireConnection: async () => connection,
        beginTransaction: async () => {},
        commitTransaction: async () => {},
        rollbackTransaction: async () => {},
        releaseConnection: async () => {},
        destroy: async () => {},
      }),
      createIntrospector: (k) => new PostgresIntrospector(k),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });
  return { db, queries };
}

function createService(opts: {
  multi?: boolean;
  hosts?: string;
  defaultHost?: string;
  affectedRows?: number;
}) {
  const { db, queries } = createFakeDb(opts.affectedRows ?? 1);
  const environmentService = {
    isCloud: jest.fn().mockReturnValue(false),
    isMultiWorkspace: jest.fn().mockReturnValue(opts.multi ?? true),
    getWorkspaceHosts: jest
      .fn()
      .mockReturnValue(opts.hosts ?? 'docmost.gevekom.one,wiki.svntn.ai'),
    getDefaultWorkspaceHost: jest.fn().mockReturnValue(opts.defaultHost ?? ''),
    getCollabUrl: jest.fn().mockReturnValue(undefined),
  } as any;
  const resolver = new WorkspaceResolverService(
    {} as any,
    environmentService,
    db as any,
  );
  const service = new WorkspaceHostBackfillService(
    environmentService,
    resolver,
    db as any,
  );
  return { service, queries };
}

describe('WorkspaceHostBackfillService', () => {
  it('does nothing without DEFAULT_WORKSPACE_HOST', async () => {
    const { service, queries } = createService({});
    await expect(service.backfillDefaultHost()).resolves.toBe(0);
    expect(queries).toHaveLength(0);
  });

  it('refuses a DEFAULT_WORKSPACE_HOST outside WORKSPACE_HOSTS', async () => {
    const { service, queries } = createService({
      defaultHost: 'evil.example.com',
    });
    await expect(service.backfillDefaultHost()).resolves.toBe(0);
    expect(queries).toHaveLength(0);
  });

  it('runs one guarded, normalised UPDATE (single workspace, NULL hostname, host free)', async () => {
    const { service, queries } = createService({
      defaultHost: 'Docmost.Gevekom.One',
    });
    await expect(service.backfillDefaultHost()).resolves.toBe(1);
    expect(queries).toHaveLength(1);
    const sqlText = queries[0].sql.replace(/\s+/g, ' ');
    expect(sqlText).toContain('UPDATE workspaces');
    expect(sqlText).toContain('WHERE hostname IS NULL');
    expect(sqlText).toContain('(SELECT count(*) FROM workspaces) = 1');
    expect(sqlText).toContain('NOT EXISTS');
    expect(queries[0].parameters).toEqual([
      'docmost.gevekom.one',
      'docmost.gevekom.one',
    ]);
  });

  it('is idempotent (0 rows when already applied)', async () => {
    const { service } = createService({
      defaultHost: 'docmost.gevekom.one',
      affectedRows: 0,
    });
    await expect(service.backfillDefaultHost()).resolves.toBe(0);
  });

  it('fails startup when multi mode is on without WORKSPACE_HOSTS', async () => {
    const { service } = createService({ hosts: '' });
    await expect(service.onApplicationBootstrap()).rejects.toThrow(
      /WORKSPACE_HOSTS/,
    );
  });

  it('is a no-op when multi mode is off', async () => {
    const { service, queries } = createService({
      multi: false,
      hosts: '',
      defaultHost: 'docmost.gevekom.one',
    });
    await expect(service.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(queries).toHaveLength(0);
  });
});
