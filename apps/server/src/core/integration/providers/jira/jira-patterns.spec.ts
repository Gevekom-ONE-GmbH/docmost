import { matchIntegrationLink } from '@docmost/editor-ext';
import { jiraPatterns } from './jira-patterns';

function firstMatch(url: string) {
  for (const pattern of jiraPatterns) {
    const match = url.match(pattern.regex);
    if (match) return { type: pattern.type, groups: match.slice(1) };
  }
  return null;
}

const MATCHES: [string, string[]][] = [
  ['https://acme.atlassian.net/browse/ABC-1', ['acme', 'ABC-1']],
  ['https://acme.atlassian.net/browse/ABC-123?focusedCommentId=1', ['acme', 'ABC-123']],
  ['https://acme.atlassian.net/browse/ABC-1#comment', ['acme', 'ABC-1']],
  ['https://Acme.Atlassian.net/browse/abc-7', ['Acme', 'abc-7']],
  ['https://my-team.atlassian.net/browse/OPS2-42', ['my-team', 'OPS2-42']],
  [
    'https://acme.atlassian.net/jira/software/c/projects/ABC/boards/3?selectedIssue=ABC-9',
    ['acme', 'ABC-9'],
  ],
  [
    'https://acme.atlassian.net/jira/software/projects/ABC/boards/3/backlog?quickFilter=1&selectedIssue=ABC-9',
    ['acme', 'ABC-9'],
  ],
  [
    'https://acme.atlassian.net/secure/RapidBoard.jspa?rapidView=1&selectedIssue=ABC-2',
    ['acme', 'ABC-2'],
  ],
];

const NON_MATCHES = [
  // Not Jira Cloud: the token must never be sent for self-hosted or lookalike hosts.
  'https://jira.example.com/browse/ABC-1',
  'https://acme.atlassian.net.evil.example/browse/ABC-1',
  'https://evil.example/acme.atlassian.net/browse/ABC-1',
  'https://user@acme.atlassian.net/browse/ABC-1',
  'https://a.b.atlassian.net/browse/ABC-1',
  // The browser resolves these to a different path.
  'https://acme.atlassian.net/browse/ABC-1/../../evil',
  'https://acme.atlassian.net/x/%2e%2e/browse/ABC-1',
  'https://acme.atlassian.net/browse\\ABC-1',
  // Not an issue key, or a key followed by more key characters.
  'https://acme.atlassian.net/browse/ABC',
  'https://acme.atlassian.net/browse/ABC-1x',
  'https://acme.atlassian.net/jira/software/c/projects/ABC/boards/3',
];

describe('jiraPatterns', () => {
  it.each(MATCHES)('matches %s', (url, groups) => {
    expect(firstMatch(url)).toEqual({ type: 'jira-issue', groups });
  });

  it.each(NON_MATCHES)('does not match %s', (url) => {
    expect(firstMatch(url)).toBeNull();
  });

  // The editor only asks the server about links its own patterns recognise.
  it.each(MATCHES)('is also recognised by the editor: %s', (url) => {
    expect(matchIntegrationLink(url)?.provider).toBe('jira');
  });
});
