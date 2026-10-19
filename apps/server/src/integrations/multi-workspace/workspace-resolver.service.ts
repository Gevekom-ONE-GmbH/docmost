import { Injectable } from '@nestjs/common';
import type { IncomingHttpHeaders } from 'http';
import { InjectKysely } from 'nestjs-kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { Workspace } from '@docmost/db/types/entity.types';
import { EnvironmentService } from '../environment/environment.service';
import { extractRequestHost, normalizeHost, parseHostList } from './host.utils';

/**
 * Single place that maps an incoming request to its workspace.
 *
 * - cloud:            subdomain label lookup (upstream behaviour, unchanged)
 * - self-hosted:      first workspace (upstream behaviour, unchanged)
 * - multi-workspace:  full request host, must be in WORKSPACE_HOSTS, looked up
 *                     in `workspaces.hostname`. Unknown/not-allowlisted hosts
 *                     resolve to NO workspace (never fall back to the first).
 */
@Injectable()
export class WorkspaceResolverService {
  private allowedHostsCache: { raw: string; hosts: string[] } = null;

  constructor(
    private readonly workspaceRepo: WorkspaceRepo,
    private readonly environmentService: EnvironmentService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  isMultiWorkspace(): boolean {
    return this.environmentService.isMultiWorkspace();
  }

  getAllowedHosts(): string[] {
    const raw = this.environmentService.getWorkspaceHosts() ?? '';
    if (!this.allowedHostsCache || this.allowedHostsCache.raw !== raw) {
      this.allowedHostsCache = { raw, hosts: parseHostList(raw) };
    }
    return this.allowedHostsCache.hosts;
  }

  isAllowedHost(host: string | null | undefined): boolean {
    const normalized = normalizeHost(host);
    if (!normalized) return false;
    return this.getAllowedHosts().includes(normalized);
  }

  getRequestHost(headers: IncomingHttpHeaders | undefined): string | null {
    return extractRequestHost(headers);
  }

  async resolveWorkspace(
    headers: IncomingHttpHeaders | undefined,
  ): Promise<Workspace | null> {
    if (this.environmentService.isCloud()) {
      const subdomain = headers?.host?.split('.')[0];
      if (!subdomain) return null;
      return (await this.workspaceRepo.findByHostname(subdomain)) ?? null;
    }

    if (this.isMultiWorkspace()) {
      const host = this.getRequestHost(headers);
      if (!host || !this.isAllowedHost(host)) return null;
      return (await this.workspaceRepo.findByHostname(host)) ?? null;
    }

    return (await this.workspaceRepo.findFirst()) ?? null;
  }

  /**
   * True if a workspace without hostname exists (e.g. the pre-multi-workspace
   * workspace that has not been backfilled yet). While such a workspace exists,
   * setup is refused so no duplicate workspace can be created for its host.
   */
  async hasWorkspaceWithoutHostname(): Promise<boolean> {
    const row = await this.db
      .selectFrom('workspaces')
      .select('id')
      .where('hostname', 'is', null)
      .limit(1)
      .executeTakeFirst();
    return !!row;
  }
}
