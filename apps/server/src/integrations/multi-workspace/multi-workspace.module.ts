import { Global, Module } from '@nestjs/common';
import { WorkspaceResolverService } from './workspace-resolver.service';
import { WorkspaceHostBackfillService } from './workspace-host-backfill.service';

/**
 * Gevekom: multi-workspace (multi-host) mode. See CUSTOMIZATIONS.md (B9).
 * Global so the domain middleware, SEO controllers and the setup guard can
 * inject the resolver without module wiring in core.
 */
@Global()
@Module({
  providers: [WorkspaceResolverService, WorkspaceHostBackfillService],
  exports: [WorkspaceResolverService],
})
export class MultiWorkspaceModule {}
