import { DomainService } from './domain.service';

function createService(opts: { multi?: boolean; cloud?: boolean }) {
  const environmentService = {
    isMultiWorkspace: jest.fn().mockReturnValue(!!opts.multi),
    isCloud: jest.fn().mockReturnValue(!!opts.cloud),
    isHttps: jest.fn().mockReturnValue(true),
    getAppUrl: jest.fn().mockReturnValue('https://docmost.gevekom.one'),
    getSubdomainHost: jest.fn().mockReturnValue(undefined),
  } as any;
  return new DomainService(environmentService);
}

describe('DomainService.getUrl', () => {
  it('returns APP_URL when multi-workspace mode is off', () => {
    const service = createService({ multi: false });
    expect(service.getUrl('wiki.svntn.ai')).toBe('https://docmost.gevekom.one');
  });

  it('returns the workspace host in multi-workspace mode', () => {
    const service = createService({ multi: true });
    expect(service.getUrl('wiki.svntn.ai')).toBe('https://wiki.svntn.ai');
  });

  it('falls back to APP_URL in multi-workspace mode without hostname', () => {
    const service = createService({ multi: true });
    expect(service.getUrl(null)).toBe('https://docmost.gevekom.one');
  });
});
