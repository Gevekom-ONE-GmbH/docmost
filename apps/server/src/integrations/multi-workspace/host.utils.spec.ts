import { extractRequestHost, normalizeHost, parseHostList } from './host.utils';

describe('host.utils', () => {
  describe('normalizeHost', () => {
    it('lower-cases, trims and strips the port', () => {
      expect(normalizeHost('  Wiki.SVNTN.ai:443 ')).toBe('wiki.svntn.ai');
      expect(normalizeHost('docmost.gevekom.one:3000')).toBe(
        'docmost.gevekom.one',
      );
    });

    it('strips a trailing dot', () => {
      expect(normalizeHost('wiki.svntn.ai.')).toBe('wiki.svntn.ai');
    });

    it('accepts a URL-ish env value', () => {
      expect(normalizeHost('https://Wiki.svntn.ai/')).toBe('wiki.svntn.ai');
    });

    it('handles IPv6 literals with port', () => {
      expect(normalizeHost('[::1]:3000')).toBe('[::1]');
    });

    it('returns null for empty or malformed values', () => {
      expect(normalizeHost(undefined)).toBeNull();
      expect(normalizeHost('')).toBeNull();
      expect(normalizeHost('   ')).toBeNull();
      expect(normalizeHost('evil host')).toBeNull();
      expect(normalizeHost('a"b.com')).toBeNull();
    });
  });

  describe('parseHostList', () => {
    it('parses comma/whitespace separated, normalised and de-duplicated', () => {
      expect(
        parseHostList(
          'docmost.gevekom.one, WIKI.svntn.ai ,wiki.svntn.ai:443\nfoo.bar',
        ),
      ).toEqual(['docmost.gevekom.one', 'wiki.svntn.ai', 'foo.bar']);
    });

    it('returns an empty list for empty input', () => {
      expect(parseHostList('')).toEqual([]);
      expect(parseHostList(undefined)).toEqual([]);
      expect(parseHostList(' , ')).toEqual([]);
    });
  });

  describe('extractRequestHost', () => {
    it('uses the Host header', () => {
      expect(extractRequestHost({ host: 'Wiki.svntn.ai:8080' })).toBe(
        'wiki.svntn.ai',
      );
    });

    it('prefers X-Forwarded-Host (trustProxy) and takes the last entry', () => {
      expect(
        extractRequestHost({
          host: 'docmost:3000',
          'x-forwarded-host': 'spoofed.example, wiki.svntn.ai',
        }),
      ).toBe('wiki.svntn.ai');
    });

    it('returns null without host information', () => {
      expect(extractRequestHost({})).toBeNull();
      expect(extractRequestHost(undefined)).toBeNull();
    });
  });
});
