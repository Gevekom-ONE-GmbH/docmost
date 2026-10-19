import { WorkspaceResolverService } from './workspace-resolver.service';

const gevekom = { id: 'ws-gevekom', hostname: 'docmost.gevekom.one' };
const svntn = { id: 'ws-svntn', hostname: 'wiki.svntn.ai' };

function createResolver(opts: {
  cloud?: boolean;
  multi?: boolean;
  hosts?: string;
}) {
  const workspaces = [gevekom, svntn];
  const workspaceRepo = {
    findFirst: jest.fn().mockResolvedValue(gevekom),
    findByHostname: jest.fn(async (hostname: string) =>
      workspaces.find(
        (w) => w.hostname.toLowerCase() === hostname.toLowerCase(),
      ),
    ),
  } as any;
  const environmentService = {
    isCloud: jest.fn().mockReturnValue(!!opts.cloud),
    isMultiWorkspace: jest.fn().mockReturnValue(!!opts.multi),
    getWorkspaceHosts: jest.fn().mockReturnValue(opts.hosts ?? ''),
  } as any;
  const resolver = new WorkspaceResolverService(
    workspaceRepo,
    environmentService,
    {} as any,
  );
  return { resolver, workspaceRepo };
}

const HOSTS = 'docmost.gevekom.one,wiki.svntn.ai';

describe('WorkspaceResolverService', () => {
  describe('multi-workspace mode', () => {
    it('resolves a known, allowlisted host to its own workspace', async () => {
      const { resolver } = createResolver({ multi: true, hosts: HOSTS });
      await expect(
        resolver.resolveWorkspace({ host: 'wiki.svntn.ai' }),
      ).resolves.toBe(svntn);
      await expect(
        resolver.resolveWorkspace({ host: 'docmost.gevekom.one' }),
      ).resolves.toBe(gevekom);
    });

    it('is case-insensitive and ignores the port', async () => {
      const { resolver, workspaceRepo } = createResolver({
        multi: true,
        hosts: HOSTS,
      });
      await expect(
        resolver.resolveWorkspace({ host: 'WIKI.Svntn.AI:443' }),
      ).resolves.toBe(svntn);
      expect(workspaceRepo.findByHostname).toHaveBeenCalledWith(
        'wiki.svntn.ai',
      );
    });

    it('returns null for an unknown host and never falls back to the first workspace', async () => {
      const { resolver, workspaceRepo } = createResolver({
        multi: true,
        hosts: HOSTS,
      });
      await expect(
        resolver.resolveWorkspace({ host: 'evil.example.com' }),
      ).resolves.toBeNull();
      expect(workspaceRepo.findFirst).not.toHaveBeenCalled();
      expect(workspaceRepo.findByHostname).not.toHaveBeenCalled();
    });

    it('returns null for a host that has a workspace but is not allowlisted', async () => {
      const { resolver, workspaceRepo } = createResolver({
        multi: true,
        hosts: 'docmost.gevekom.one',
      });
      await expect(
        resolver.resolveWorkspace({ host: 'wiki.svntn.ai' }),
      ).resolves.toBeNull();
      expect(workspaceRepo.findByHostname).not.toHaveBeenCalled();
    });

    it('returns null for an allowlisted host without workspace yet', async () => {
      const { resolver } = createResolver({
        multi: true,
        hosts: HOSTS + ',new.example.com',
      });
      await expect(
        resolver.resolveWorkspace({ host: 'new.example.com' }),
      ).resolves.toBeNull();
    });

    it('returns null without a host header', async () => {
      const { resolver } = createResolver({ multi: true, hosts: HOSTS });
      await expect(resolver.resolveWorkspace({})).resolves.toBeNull();
    });

    it('uses X-Forwarded-Host when present', async () => {
      const { resolver } = createResolver({ multi: true, hosts: HOSTS });
      await expect(
        resolver.resolveWorkspace({
          host: 'docmost-internal:3000',
          'x-forwarded-host': 'wiki.svntn.ai',
        }),
      ).resolves.toBe(svntn);
    });

    it('checks the allowlist case-insensitively', () => {
      const { resolver } = createResolver({
        multi: true,
        hosts: 'Docmost.Gevekom.One',
      });
      expect(resolver.isAllowedHost('docmost.gevekom.one:443')).toBe(true);
      expect(resolver.isAllowedHost('wiki.svntn.ai')).toBe(false);
      expect(resolver.isAllowedHost(undefined)).toBe(false);
    });
  });

  describe('multi-workspace mode off', () => {
    it('keeps the self-hosted behaviour (first workspace, any host)', async () => {
      const { resolver, workspaceRepo } = createResolver({
        multi: false,
        hosts: HOSTS,
      });
      await expect(
        resolver.resolveWorkspace({ host: 'whatever.example' }),
      ).resolves.toBe(gevekom);
      expect(workspaceRepo.findFirst).toHaveBeenCalled();
      expect(workspaceRepo.findByHostname).not.toHaveBeenCalled();
    });

    it('returns null when no workspace exists yet', async () => {
      const { resolver, workspaceRepo } = createResolver({ multi: false });
      workspaceRepo.findFirst.mockResolvedValue(undefined);
      await expect(resolver.resolveWorkspace({ host: 'x' })).resolves.toBeNull();
    });

    it('keeps the cloud behaviour (subdomain label)', async () => {
      const { resolver, workspaceRepo } = createResolver({ cloud: true });
      await resolver.resolveWorkspace({ host: 'acme.docmost.com' });
      expect(workspaceRepo.findByHostname).toHaveBeenCalledWith('acme');
    });
  });
});
