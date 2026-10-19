import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SetupGuard, getSetupHostname } from './setup.guard';
import { WorkspaceResolverService } from '../../../integrations/multi-workspace/workspace-resolver.service';

const HOSTS = 'docmost.gevekom.one,wiki.svntn.ai';

function createCtx(headers: Record<string, string>) {
  const raw: any = { headers };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => ({ raw, headers }) }),
  } as unknown as ExecutionContext;
  return { ctx, raw };
}

function createGuard(opts: {
  cloud?: boolean;
  multi?: boolean;
  count?: number;
  existingHosts?: string[];
  unassigned?: boolean;
}) {
  const workspaceRepo = {
    count: jest.fn().mockResolvedValue(opts.count ?? 0),
    findByHostname: jest.fn(async (host: string) =>
      (opts.existingHosts ?? []).includes(host.toLowerCase())
        ? { id: 'ws', hostname: host }
        : undefined,
    ),
  } as any;
  const environmentService = {
    isCloud: jest.fn().mockReturnValue(!!opts.cloud),
    isMultiWorkspace: jest.fn().mockReturnValue(!!opts.multi),
    getWorkspaceHosts: jest.fn().mockReturnValue(HOSTS),
  } as any;
  const resolver = new WorkspaceResolverService(
    workspaceRepo,
    environmentService,
    {} as any,
  );
  jest
    .spyOn(resolver, 'hasWorkspaceWithoutHostname')
    .mockResolvedValue(!!opts.unassigned);
  const guard = new SetupGuard(workspaceRepo, environmentService, resolver);
  return { guard, workspaceRepo };
}

describe('SetupGuard', () => {
  describe('multi-workspace mode off (upstream behaviour)', () => {
    it('allows setup when no workspace exists', async () => {
      const { guard } = createGuard({ count: 0 });
      const { ctx } = createCtx({ host: 'anything' });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it('blocks setup once any workspace exists', async () => {
      const { guard } = createGuard({ count: 1 });
      const { ctx } = createCtx({ host: 'anything' });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('never allows setup in cloud mode', async () => {
      const { guard } = createGuard({ cloud: true });
      const { ctx } = createCtx({ host: 'anything' });
      await expect(guard.canActivate(ctx)).resolves.toBe(false);
    });
  });

  describe('multi-workspace mode', () => {
    it('allows setup for an allowlisted host without workspace and records the host', async () => {
      const { guard } = createGuard({
        multi: true,
        count: 1,
        existingHosts: ['docmost.gevekom.one'],
      });
      const { ctx, raw } = createCtx({ host: 'Wiki.Svntn.ai:443' });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(getSetupHostname(raw)).toBe('wiki.svntn.ai');
    });

    it('blocks setup for a host outside WORKSPACE_HOSTS', async () => {
      const { guard } = createGuard({ multi: true, count: 0 });
      const { ctx, raw } = createCtx({ host: 'evil.example.com' });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      expect(getSetupHostname(raw)).toBeUndefined();
    });

    it('blocks setup without host header', async () => {
      const { guard } = createGuard({ multi: true });
      const { ctx } = createCtx({});
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('blocks setup when the host already has a workspace', async () => {
      const { guard } = createGuard({
        multi: true,
        existingHosts: ['wiki.svntn.ai'],
      });
      const { ctx } = createCtx({ host: 'wiki.svntn.ai' });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('blocks setup while a workspace without hostname (not backfilled) exists', async () => {
      const { guard } = createGuard({ multi: true, unassigned: true });
      const { ctx } = createCtx({ host: 'docmost.gevekom.one' });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('does not use the global workspace count', async () => {
      const { guard, workspaceRepo } = createGuard({ multi: true, count: 5 });
      const { ctx } = createCtx({ host: 'wiki.svntn.ai' });
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(workspaceRepo.count).not.toHaveBeenCalled();
    });
  });
});
