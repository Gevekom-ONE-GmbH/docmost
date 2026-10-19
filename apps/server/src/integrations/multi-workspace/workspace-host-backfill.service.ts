import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectKysely } from 'nestjs-kysely';
import { sql } from 'kysely';
import { KyselyDB } from '@docmost/db/types/kysely.types';
import { EnvironmentService } from '../environment/environment.service';
import { WorkspaceResolverService } from './workspace-resolver.service';
import { normalizeHost } from './host.utils';

/**
 * Multi-workspace startup checks + one-time hostname backfill.
 *
 * Backfill (DEFAULT_WORKSPACE_HOST): assigns the host to the pre-existing
 * workspace with a single conditional UPDATE that only matches when
 *   - exactly ONE workspace row exists,
 *   - that workspace has hostname NULL,
 *   - no workspace already owns the host.
 * It is idempotent and safe with several replicas booting concurrently
 * (the second UPDATE simply matches 0 rows; the unique index on
 * LOWER(hostname) is the final guard).
 */
@Injectable()
export class WorkspaceHostBackfillService implements OnApplicationBootstrap {
  private readonly logger = new Logger('MultiWorkspace');

  constructor(
    private readonly environmentService: EnvironmentService,
    private readonly workspaceResolver: WorkspaceResolverService,
    @InjectKysely() private readonly db: KyselyDB,
  ) {}

  async onApplicationBootstrap() {
    if (!this.environmentService.isMultiWorkspace()) return;

    const hosts = this.workspaceResolver.getAllowedHosts();
    if (hosts.length === 0) {
      // Fail closed: without an allowlist no request would ever resolve.
      throw new Error(
        'MULTI_WORKSPACE=true requires WORKSPACE_HOSTS (comma-separated list of full hostnames).',
      );
    }
    this.logger.log(`Multi-workspace mode enabled for hosts: ${hosts.join(', ')}`);

    if (this.environmentService.getCollabUrl()) {
      this.logger.warn(
        'COLLAB_URL is set; in multi-workspace mode leave it empty so each host uses its own /collab endpoint.',
      );
    }

    try {
      await this.backfillDefaultHost();
    } catch (err: any) {
      this.logger.error(`Hostname backfill failed: ${err?.message ?? err}`);
    }

    try {
      if (await this.workspaceResolver.hasWorkspaceWithoutHostname()) {
        this.logger.warn(
          'A workspace without hostname exists; it is NOT reachable in multi-workspace mode and setup is blocked until it gets a hostname (DEFAULT_WORKSPACE_HOST or manual SQL).',
        );
      }
    } catch (err) {
      // e.g. fresh database before migrations — nothing to report
    }
  }

  /** Returns the number of updated rows (0 or 1). */
  async backfillDefaultHost(): Promise<number> {
    const rawHost = this.environmentService.getDefaultWorkspaceHost();
    if (!rawHost) return 0;

    const host = normalizeHost(rawHost);
    if (!host || !this.workspaceResolver.isAllowedHost(host)) {
      this.logger.error(
        `DEFAULT_WORKSPACE_HOST "${rawHost}" is not in WORKSPACE_HOSTS; backfill skipped.`,
      );
      return 0;
    }

    const result = await sql`
      UPDATE workspaces
         SET hostname = ${host}, updated_at = now()
       WHERE hostname IS NULL
         AND (SELECT count(*) FROM workspaces) = 1
         AND NOT EXISTS (
           SELECT 1 FROM workspaces w WHERE LOWER(w.hostname) = ${host}
         )
    `.execute(this.db);

    const updated = Number(result.numAffectedRows ?? 0);
    if (updated > 0) {
      this.logger.log(`Backfilled hostname "${host}" on the existing workspace.`);
    }
    return updated;
  }
}
