import { Injectable } from '@nestjs/common';
import {
  IntegrationProvider,
  IntegrationDefinition,
  LinkDescription,
  ProviderAccount,
  ResolveAccountOpts,
  UnfurlOpts,
  UnfurlResult,
} from '../../registry/integration-provider.interface';
import { JiraService } from './jira.service';
import { jiraPatterns } from './jira-patterns';

// Gevekom: clean-room Jira Cloud provider (upstream ships Jira only in the EE module).
@Injectable()
export class JiraProvider extends IntegrationProvider {
  definition: IntegrationDefinition = {
    type: 'jira',
    name: 'Jira',
    description: 'Link previews for Jira Cloud issues',
    icon: 'jira',
    capabilities: ['oauth', 'unfurl'],
    oauth: {
      authUrl: 'https://auth.atlassian.com/authorize',
      tokenUrl: 'https://auth.atlassian.com/oauth/token',
      scopes: ['read:jira-work', 'read:jira-user', 'offline_access'],
      // INTEGRATION_ATLASSIAN_CLIENT_ID / INTEGRATION_ATLASSIAN_CLIENT_SECRET
      credentialsKey: 'atlassian',
      authParams: { audience: 'api.atlassian.com', prompt: 'consent' },
    },
    unfurlPatterns: jiraPatterns,
  };

  constructor(private readonly jiraService: JiraService) {
    super();
  }

  getUnfurlHosts(): string[] {
    return ['*.atlassian.net'];
  }

  async resolveAccount(opts: ResolveAccountOpts): Promise<ProviderAccount> {
    return this.jiraService.getAccount(opts.accessToken);
  }

  async unfurl(opts: UnfurlOpts): Promise<UnfurlResult> {
    const { match, patternType, accessToken, url } = opts;

    switch (patternType) {
      case 'jira-issue':
        return this.jiraService.unfurlIssue(
          accessToken,
          `${match[1].toLowerCase()}.atlassian.net`,
          match[2].toUpperCase(),
          url,
        );

      default:
        throw new Error(`Unknown Jira pattern type: ${patternType}`);
    }
  }

  describeLink(
    patternType: string,
    match: RegExpMatchArray,
  ): LinkDescription | null {
    if (patternType !== 'jira-issue') return null;
    return {
      title: match[2].toUpperCase(),
      description: `${match[1].toLowerCase()}.atlassian.net`,
    };
  }
}
