import { proxyFetch } from '../../../../common/proxy-fetch';
import {
  ProviderApiError,
  TokenInvalidError,
  UnfurlForbiddenError,
} from '../../registry/integration-provider.interface';
import { JiraProvider } from './jira.provider';
import { JiraService } from './jira.service';
import { jiraPatterns } from './jira-patterns';

// Mock only proxyFetch so the real providerApiFetch handles statuses.
jest.mock('../../../../common/proxy-fetch', () => ({
  proxyFetch: jest.fn(),
}));

const fetchMock = proxyFetch as jest.Mock;

const CLOUD_ID = '11111111-2222-3333-4444-555555555555';
const SITES = [
  {
    id: '99999999-2222-3333-4444-555555555555',
    url: 'https://other.atlassian.net',
    name: 'Other',
  },
  { id: CLOUD_ID, url: 'https://acme.atlassian.net', name: 'Acme' },
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function unfurl(provider: JiraProvider, url: string) {
  const pattern = jiraPatterns.find((p) => p.regex.test(url));
  return provider.unfurl({
    url,
    accessToken: 'token',
    match: url.match(pattern.regex),
    patternType: pattern.type,
    userId: 'user-1',
    integrationId: 'integration-1',
  });
}

describe('JiraProvider', () => {
  const provider = new JiraProvider(new JiraService());

  beforeEach(() => fetchMock.mockReset());

  it('uses Atlassian OAuth with shared atlassian credentials', () => {
    expect(provider.definition.oauth).toMatchObject({
      authUrl: 'https://auth.atlassian.com/authorize',
      tokenUrl: 'https://auth.atlassian.com/oauth/token',
      credentialsKey: 'atlassian',
      authParams: { audience: 'api.atlassian.com', prompt: 'consent' },
    });
    expect(provider.definition.oauth.scopes).toContain('offline_access');
    expect(provider.getUnfurlHosts()).toEqual(['*.atlassian.net']);
  });

  it('unfurls an issue on the matching site', async () => {
    fetchMock
      .mockResolvedValueOnce(json(SITES))
      .mockResolvedValueOnce(
        json({
          key: 'ABC-1',
          fields: {
            summary: 'Fix the login',
            status: { name: 'In Progress', statusCategory: { colorName: 'yellow' } },
            assignee: {
              displayName: 'Ada Lovelace',
              avatarUrls: { '48x48': 'https://avatar.example/ada.png' },
            },
            issuetype: { name: 'Bug', iconUrl: 'https://acme.atlassian.net/bug.svg' },
            priority: { name: 'High' },
            updated: '2026-10-29T10:00:00.000+0000',
          },
        }),
      );

    const result = await unfurl(provider, 'https://acme.atlassian.net/browse/abc-1');

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.atlassian.com/oauth/token/accessible-resources',
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      `https://api.atlassian.com/ex/jira/${CLOUD_ID}/rest/api/3/issue/ABC-1?fields=summary,status,assignee,issuetype,priority,updated`,
    );
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer token');
    expect(result).toEqual({
      title: 'Fix the login',
      description: 'ABC-1 · Acme',
      url: 'https://acme.atlassian.net/browse/abc-1',
      provider: 'jira',
      providerIcon: 'jira',
      status: 'In Progress',
      statusColor: 'blue',
      author: 'Ada Lovelace',
      authorAvatarUrl: 'https://avatar.example/ada.png',
      metadata: {
        type: 'issue',
        issueKey: 'ABC-1',
        issueType: 'Bug',
        issueTypeIconUrl: 'https://acme.atlassian.net/bug.svg',
        priority: 'High',
        updatedAt: '2026-10-29T10:00:00.000+0000',
      },
    });
  });

  it('drops non-https image URLs', async () => {
    fetchMock.mockResolvedValueOnce(json(SITES)).mockResolvedValueOnce(
      json({
        key: 'ABC-1',
        fields: {
          summary: 'x',
          assignee: { displayName: 'A', avatarUrls: { '48x48': 'javascript:alert(1)' } },
          issuetype: { iconUrl: 'http://acme.atlassian.net/bug.svg' },
        },
      }),
    );

    const result = await unfurl(provider, 'https://acme.atlassian.net/browse/ABC-1');

    expect(result.authorAvatarUrl).toBeUndefined();
    expect(result.metadata.issueTypeIconUrl).toBeUndefined();
    expect(result.statusColor).toBe('gray');
  });

  it('refuses a site the token cannot access, without calling Jira', async () => {
    fetchMock.mockResolvedValueOnce(json(SITES));

    await expect(
      unfurl(provider, 'https://foreign.atlassian.net/browse/ABC-1'),
    ).rejects.toBeInstanceOf(UnfurlForbiddenError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats a 404 issue as not visible', async () => {
    fetchMock
      .mockResolvedValueOnce(json(SITES))
      .mockResolvedValueOnce(json({ errorMessages: ['nope'] }, 404));

    await expect(
      unfurl(provider, 'https://acme.atlassian.net/browse/ABC-1'),
    ).rejects.toBeInstanceOf(UnfurlForbiddenError);
  });

  it('surfaces other API errors', async () => {
    fetchMock
      .mockResolvedValueOnce(json(SITES))
      .mockResolvedValueOnce(json({}, 500));

    await expect(
      unfurl(provider, 'https://acme.atlassian.net/browse/ABC-1'),
    ).rejects.toBeInstanceOf(ProviderApiError);
  });

  it('reports a revoked token as invalid', async () => {
    fetchMock.mockResolvedValueOnce(json({}, 401));

    await expect(
      unfurl(provider, 'https://acme.atlassian.net/browse/ABC-1'),
    ).rejects.toBeInstanceOf(TokenInvalidError);
  });

  it('ignores resources with a malformed cloud id', async () => {
    fetchMock.mockResolvedValueOnce(
      json([{ id: '../../evil', url: 'https://acme.atlassian.net', name: 'x' }]),
    );

    await expect(
      unfurl(provider, 'https://acme.atlassian.net/browse/ABC-1'),
    ).rejects.toBeInstanceOf(UnfurlForbiddenError);
  });

  it('reads the connected account from the first site', async () => {
    fetchMock
      .mockResolvedValueOnce(json(SITES))
      .mockResolvedValueOnce(
        json({ accountId: '5b10ac8d82e05b22cc7d4ef5', displayName: 'Ada Lovelace' }),
      );

    await expect(
      provider.resolveAccount({ accessToken: 'token', tokenResponse: {} }),
    ).resolves.toEqual({
      id: '5b10ac8d82e05b22cc7d4ef5',
      displayName: 'Ada Lovelace',
    });
    expect(fetchMock.mock.calls[1][0]).toBe(
      `https://api.atlassian.com/ex/jira/${SITES[0].id}/rest/api/3/myself`,
    );
  });

  it('describes a link without a token', () => {
    const url = 'https://acme.atlassian.net/browse/abc-1';
    const pattern = jiraPatterns.find((p) => p.regex.test(url));

    expect(provider.describeLink(pattern.type, url.match(pattern.regex))).toEqual({
      title: 'ABC-1',
      description: 'acme.atlassian.net',
    });
  });
});
