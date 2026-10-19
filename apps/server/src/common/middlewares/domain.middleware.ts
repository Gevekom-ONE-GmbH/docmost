import { Injectable, NestMiddleware } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { WorkspaceResolverService } from '../../integrations/multi-workspace/workspace-resolver.service';

@Injectable()
export class DomainMiddleware implements NestMiddleware {
  constructor(private workspaceResolver: WorkspaceResolverService) {}
  async use(
    req: FastifyRequest['raw'],
    res: FastifyReply['raw'],
    next: () => void,
  ) {
    // Gevekom: resolution (self-hosted / cloud / multi-workspace by host)
    // is centralised in WorkspaceResolverService.
    const workspace = await this.workspaceResolver.resolveWorkspace(
      req.headers,
    );

    if (!workspace) {
      (req as any).workspaceId = null;
      return next();
    }

    // TODO: unify
    (req as any).workspaceId = workspace.id;
    (req as any).workspace = workspace;

    next();
  }
}
