import { Injectable } from '@nestjs/common';
import {
  ProviderAccount,
  ProviderApiError,
  UnfurlForbiddenError,
  UnfurlResult,
} from '../../registry/integration-provider.interface';
import { providerApiFetch } from '../../utils/provider-fetch';
import { toProviderAccount } from '../../utils/integration.utils';

const ATLASSIAN_API = 'https://api.atlassian.com';
const CLOUD_ID_RE = /^[0-9a-f-]{36}$/i;
const ISSUE_FIELDS = 'summary,status,assignee,issuetype,priority,updated';

// Jira status category colours, mapped to the badge palette the client renders.
const STATUS_CATEGORY_COLORS: Record<string, string> = {
  'blue-gray': 'gray',
  'medium-gray': 'gray',
  yellow: 'blue',
  green: 'green',
};

export type JiraSite = {
  // Atlassian cloud id, used in the api.atlassian.com/ex/jira/<cloudId> base path.
  id: string;
  hostname: string;
  name?: string;
};

@Injectable()
export class JiraService {
  // Sites this token can reach; a user may belong to several Atlassian sites.
  async getAccessibleSites(accessToken: string): Promise<JiraSite[]> {
    const data = await this.get(
      accessToken,
      `${ATLASSIAN_API}/oauth/token/accessible-resources`,
    );
    if (!Array.isArray(data)) return [];

    const sites: JiraSite[] = [];
    for (const resource of data) {
      if (typeof resource?.id !== 'string' || !CLOUD_ID_RE.test(resource.id)) {
        continue;
      }
      try {
        sites.push({
          id: resource.id,
          hostname: new URL(resource.url).hostname.toLowerCase(),
          name: typeof resource.name === 'string' ? resource.name : undefined,
        });
      } catch {
        // Skip resources without a usable site URL.
      }
    }
    return sites;
  }

  async getAccount(accessToken: string): Promise<ProviderAccount> {
    const [site] = await this.getAccessibleSites(accessToken);
    if (!site) {
      throw new Error('Jira token has no accessible site');
    }
    const me = await this.get(
      accessToken,
      `${this.siteApi(site)}/rest/api/3/myself`,
    );
    return toProviderAccount({
      id: me?.accountId,
      displayName: me?.displayName,
    });
  }

  async unfurlIssue(
    accessToken: string,
    siteHostname: string,
    issueKey: string,
    url: string,
  ): Promise<UnfurlResult> {
    const sites = await this.getAccessibleSites(accessToken);
    const site = sites.find((s) => s.hostname === siteHostname);
    if (!site) {
      throw new UnfurlForbiddenError(
        `Jira site ${siteHostname} is not accessible with this connection`,
      );
    }

    let issue: any;
    try {
      issue = await this.get(
        accessToken,
        `${this.siteApi(site)}/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=${ISSUE_FIELDS}`,
      );
    } catch (err) {
      // Jira answers 404 both for missing issues and for issues the user cannot see.
      if (err instanceof ProviderApiError && err.status === 404) {
        throw new UnfurlForbiddenError(`Jira issue ${issueKey} not found`);
      }
      throw err;
    }

    const fields = issue?.fields ?? {};
    const key = typeof issue?.key === 'string' ? issue.key : issueKey;
    const assignee = fields.assignee;

    return {
      title: fields.summary || key,
      description: [key, site.name].filter(Boolean).join(' · '),
      url,
      provider: 'jira',
      providerIcon: 'jira',
      status: fields.status?.name,
      statusColor:
        STATUS_CATEGORY_COLORS[fields.status?.statusCategory?.colorName] ??
        'gray',
      author: assignee?.displayName,
      authorAvatarUrl: this.httpsUrl(assignee?.avatarUrls?.['48x48']),
      metadata: {
        type: 'issue',
        issueKey: key,
        issueType: fields.issuetype?.name,
        issueTypeIconUrl: this.httpsUrl(fields.issuetype?.iconUrl),
        priority: fields.priority?.name,
        updatedAt: fields.updated,
      },
    };
  }

  private siteApi(site: JiraSite): string {
    return `${ATLASSIAN_API}/ex/jira/${site.id}`;
  }

  // Image URLs end up in <img src>, so only plain https URLs pass.
  private httpsUrl(value: unknown): string | undefined {
    return typeof value === 'string' && value.startsWith('https://')
      ? value
      : undefined;
  }

  private async get(accessToken: string, url: string): Promise<any> {
    const response = await providerApiFetch('Jira', url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    return response.json();
  }
}
