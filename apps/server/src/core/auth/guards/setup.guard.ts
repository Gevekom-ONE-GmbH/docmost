import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { WorkspaceRepo } from '@docmost/db/repos/workspace/workspace.repo';
import { EnvironmentService } from '../../../integrations/environment/environment.service';
import { WorkspaceResolverService } from '../../../integrations/multi-workspace/workspace-resolver.service';

// Gevekom multi-workspace: the host validated by SetupGuard, read by the
// setup endpoint so the new workspace is bound to exactly this host.
const SETUP_HOSTNAME = Symbol('setupHostname');

export function getSetupHostname(rawRequest: any): string | undefined {
  return rawRequest?.[SETUP_HOSTNAME];
}

@Injectable()
export class SetupGuard implements CanActivate {
  constructor(
    private workspaceRepo: WorkspaceRepo,
    private environmentService: EnvironmentService,
    private workspaceResolver: WorkspaceResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.environmentService.isCloud()) {
      return false;
    }

    if (this.workspaceResolver.isMultiWorkspace()) {
      return this.canSetupForHost(context);
    }

    const workspaceCount = await this.workspaceRepo.count();
    if (workspaceCount > 0) {
      throw new ForbiddenException('Workspace setup already completed.');
    }
    return true;
  }

  private async canSetupForHost(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const raw = req?.raw ?? req;
    const host = this.workspaceResolver.getRequestHost(raw?.headers);

    if (!host || !this.workspaceResolver.isAllowedHost(host)) {
      throw new ForbiddenException('Workspace setup is not allowed on this host.');
    }

    if (await this.workspaceRepo.findByHostname(host)) {
      throw new ForbiddenException('Workspace setup already completed.');
    }

    // A legacy workspace without hostname may belong to this very host;
    // refuse until it has been assigned (DEFAULT_WORKSPACE_HOST / SQL).
    if (await this.workspaceResolver.hasWorkspaceWithoutHostname()) {
      throw new ForbiddenException('Workspace setup already completed.');
    }

    raw[SETUP_HOSTNAME] = host;
    return true;
  }
}
